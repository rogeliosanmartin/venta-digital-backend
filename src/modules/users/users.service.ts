import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserType } from '../../common/enums/user-type.enum';
import {
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MONITOR_PERMISSIONS,
  PERMISSION_CATALOG,
} from '../../common/constants/permissions.constants';
import { UsersRepository } from './repositories/users.repository';
import { PermissionsRepository } from './repositories/permissions.repository';
import { UserPermissionsRepository } from './repositories/user-permissions.repository';
import {
  AuditActor,
  AuditService,
  diffChanges,
} from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';
import { AuditEntityType } from '../audit/enums/audit-entity-type.enum';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly permissionsRepository: PermissionsRepository,
    private readonly userPermissionsRepository: UserPermissionsRepository,
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
  ) {}

  /** Al arrancar: siembra permisos y admin inicial si hace falta. */
  async onModuleInit() {
    await this.seedPermissions();
    await this.seedAdminIfNeeded();
  }

  private async seedPermissions() {
    for (const item of PERMISSION_CATALOG) {
      const exists = await this.permissionsRepository.findByCode(item.code);
      if (!exists) {
        await this.permissionsRepository.createAndSave({
          code: item.code,
          name: item.name,
          description: item.description,
        });
      }
    }
  }

  private async seedAdminIfNeeded() {
    const adminCount = await this.usersRepository.countByType(UserType.ADMIN);
    if (adminCount > 0) {
      return;
    }

    const username = this.config.get<string>('ADMIN_USERNAME') ?? 'admin';
    const password = this.config.get<string>('ADMIN_PASSWORD') ?? 'AdminVd2026!';
    const fullName =
      this.config.get<string>('ADMIN_NAME') ?? 'Administrador Venta Digital';

    await this.createUser(
      {
        type: UserType.ADMIN,
        fullName,
        username,
        password,
      },
      null,
    );
  }

  async createUser(dto: CreateUserDto, actor?: AuditActor | null) {
    this.assertCreatePayload(dto);

    const cellphone =
      dto.type === UserType.VENDEDOR
        ? this.normalizeCellphone(dto.cellphone)
        : null;

    if (dto.type === UserType.VENDEDOR) {
      // WhatsApp único entre vendedores (aunque el otro esté inactivo).
      await this.assertSellerCellphoneAvailable(cellphone as string);
    } else {
      const exists = await this.usersRepository.findByUsername(
        dto.username as string,
      );
      if (exists) {
        throw new ConflictException('Ya existe un usuario con ese username');
      }
    }

    const passwordHash =
      dto.password != null ? await bcrypt.hash(dto.password, 10) : null;

    const user = await this.usersRepository.createAndSave({
      type: dto.type,
      fullName: dto.fullName,
      cellphone,
      username: dto.username ?? null,
      passwordHash,
      active: true,
    });

    const codes = this.resolveDefaultPermissions(dto);
    await this.assignPermissions(user, codes);

    const created = await this.findById(user.id);
    const resolvedActor = await this.resolveActor(actor);

    await this.auditService.record({
      actor: resolvedActor,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      summary: `${this.actorLabel(resolvedActor)} dio de alta al usuario ${created.fullName} (${created.type})`,
      details: {
        after: this.toAuditSnapshot(created),
      },
    });

    return created;
  }

  async listUsers(type?: UserType) {
    const users = await this.usersRepository.list(type);
    return users.map((u) => this.toPublic(u));
  }

  async findById(id: number) {
    const user = await this.usersRepository.findByIdWithPermissions(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.toPublic(user);
  }

  async updateUser(
    id: number,
    dto: UpdateUserDto,
    actor?: AuditActor | null,
  ) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    this.assertUpdatePayload(user, dto);
    const before = this.toAuditSnapshot(this.toPublic(user));
    let passwordChanged = false;

    if (user.type === UserType.VENDEDOR) {
      const cellphone = this.normalizeCellphone(dto.cellphone) as string;
      await this.assertSellerCellphoneAvailable(cellphone, id);
      user.cellphone = cellphone;
    } else {
      const username = dto.username as string;
      const taken = await this.usersRepository.findByUsernameExcludingId(
        username,
        id,
      );
      if (taken) {
        throw new ConflictException('Ya existe un usuario con ese username');
      }
      user.username = username;

      if (dto.password) {
        user.passwordHash = await bcrypt.hash(dto.password, 10);
        passwordChanged = true;
      }
    }

    user.fullName = dto.fullName.trim();
    await this.usersRepository.save(user);

    const updated = await this.findById(id);
    const after = this.toAuditSnapshot(updated);
    const changes = diffChanges(before, after);
    if (passwordChanged) {
      changes.password = { from: '(oculto)', to: '(actualizada)' };
    }

    const resolvedActor = await this.resolveActor(actor);
    await this.auditService.record({
      actor: resolvedActor,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.USER,
      entityId: id,
      summary: `${this.actorLabel(resolvedActor)} modificó al usuario ${updated.fullName}`,
      details: { changes },
    });

    return updated;
  }

  /**
   * Habilita o deshabilita un usuario.
   * No permite desactivarse a sí mismo ni dejar el sistema sin admin activo.
   */
  async setUserActive(
    id: number,
    active: boolean,
    actorUserId: number,
  ) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.active === active) {
      return this.findById(id);
    }

    if (!active && id === actorUserId) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    }

    if (!active && user.type === UserType.ADMIN) {
      const activeAdmins = await this.usersRepository.countActiveAdmins();
      if (activeAdmins <= 1) {
        throw new BadRequestException(
          'Debe permanecer al menos un administrador activo',
        );
      }
    }

    const beforeActive = user.active;
    user.active = active;
    await this.usersRepository.save(user);

    const updated = await this.findById(id);
    const resolvedActor = await this.resolveActor({ userId: actorUserId });
    const action = active ? AuditAction.ACTIVATE : AuditAction.DEACTIVATE;

    await this.auditService.record({
      actor: resolvedActor,
      action,
      entityType: AuditEntityType.USER,
      entityId: id,
      summary: active
        ? `${this.actorLabel(resolvedActor)} habilitó al usuario ${updated.fullName}`
        : `${this.actorLabel(resolvedActor)} deshabilitó al usuario ${updated.fullName}`,
      details: {
        changes: {
          active: { from: beforeActive, to: active },
        },
      },
    });

    return updated;
  }

  async listPermissions() {
    return this.permissionsRepository.listAll();
  }

  private async resolveActor(
    actor?: AuditActor | null,
  ): Promise<AuditActor> {
    if (actor?.userId == null) {
      return {
        userId: null,
        fullName: actor?.fullName ?? 'Sistema',
        type: actor?.type ?? 'SYSTEM',
      };
    }

    if (actor.fullName && actor.type) {
      return actor;
    }

    const user = await this.usersRepository.findById(actor.userId);
    return {
      userId: actor.userId,
      fullName: user?.fullName ?? actor.fullName ?? `Usuario #${actor.userId}`,
      type: user?.type ?? actor.type ?? null,
    };
  }

  private actorLabel(actor: AuditActor): string {
    return actor.fullName || (actor.userId != null ? `Usuario #${actor.userId}` : 'Sistema');
  }

  private toAuditSnapshot(user: {
    id: number;
    type: UserType;
    fullName: string;
    cellphone: string | null;
    username: string | null;
    active: boolean;
  }) {
    return {
      id: user.id,
      type: user.type,
      fullName: user.fullName,
      cellphone: user.cellphone,
      username: user.username,
      active: user.active,
    };
  }

  private assertUpdatePayload(user: User, dto: UpdateUserDto) {
    if (user.type === UserType.VENDEDOR && !dto.cellphone) {
      throw new BadRequestException('El vendedor requiere cellphone');
    }
    if (
      (user.type === UserType.MONITOR || user.type === UserType.ADMIN) &&
      !dto.username
    ) {
      throw new BadRequestException('Monitor/Admin requieren username');
    }
  }

  private assertCreatePayload(dto: CreateUserDto) {
    if (dto.type === UserType.VENDEDOR && !dto.cellphone) {
      throw new BadRequestException('El vendedor requiere cellphone');
    }
    if (
      (dto.type === UserType.MONITOR || dto.type === UserType.ADMIN) &&
      (!dto.username || !dto.password)
    ) {
      throw new BadRequestException(
        'Monitor/Admin requieren username y password',
      );
    }
  }

  private normalizeCellphone(cellphone?: string | null): string | null {
    if (cellphone == null) return null;
    return cellphone.trim();
  }

  /**
   * El número de WhatsApp no puede repetirse entre vendedores.
   * Aplica también si el otro vendedor está deshabilitado.
   */
  private async assertSellerCellphoneAvailable(
    cellphone: string,
    excludeId?: number,
  ) {
    const taken =
      excludeId != null
        ? await this.usersRepository.findSellerByCellphoneExcludingId(
            cellphone,
            excludeId,
          )
        : await this.usersRepository.findSellerByCellphone(cellphone);

    if (taken) {
      throw new ConflictException(
        'El número de WhatsApp ya está registrado en otro vendedor',
      );
    }

    // Respaldo: unicidad global de columna cellphone en vd_users
    const anyUser =
      excludeId != null
        ? await this.usersRepository.findByCellphoneExcludingId(
            cellphone,
            excludeId,
          )
        : await this.usersRepository.findByCellphone(cellphone);

    if (anyUser) {
      throw new ConflictException(
        'El número de WhatsApp ya está registrado en otro vendedor',
      );
    }
  }

  private resolveDefaultPermissions(dto: CreateUserDto): string[] {
    if (dto.permissionCodes?.length) {
      return dto.permissionCodes;
    }
    if (dto.type === UserType.ADMIN) {
      return [...DEFAULT_ADMIN_PERMISSIONS];
    }
    if (dto.type === UserType.MONITOR) {
      return [...DEFAULT_MONITOR_PERMISSIONS];
    }
    // Vendedor: sin permisos de menú monitor; accede a sus ventas por rol.
    return [];
  }

  private async assignPermissions(user: User, codes: string[]) {
    if (!codes.length) {
      return;
    }

    const permissions = await this.permissionsRepository.findByCodes(codes);
    for (const permission of permissions) {
      await this.userPermissionsRepository.assign(user, permission);
    }
  }

  private toPublic(user: User) {
    return {
      id: user.id,
      type: user.type,
      fullName: user.fullName,
      cellphone: user.cellphone,
      username: user.username,
      active: user.active,
      permissions: (user.userPermissions ?? [])
        .map((up) => up.permission?.code)
        .filter(Boolean),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
