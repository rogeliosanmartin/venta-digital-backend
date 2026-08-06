import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Permission } from './entities/permission.entity';
import { UserPermission } from './entities/user-permission.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserType } from '../../common/enums/user-type.enum';
import {
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MONITOR_PERMISSIONS,
  PERMISSION_CATALOG,
} from '../../common/constants/permissions.constants';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Permission)
    private readonly permissionsRepo: Repository<Permission>,
    @InjectRepository(UserPermission)
    private readonly userPermissionsRepo: Repository<UserPermission>,
    private readonly config: ConfigService,
  ) {}

  /** Al arrancar: siembra permisos y admin inicial si hace falta. */
  async onModuleInit() {
    await this.seedPermissions();
    await this.seedAdminIfNeeded();
  }

  private async seedPermissions() {
    for (const item of PERMISSION_CATALOG) {
      const exists = await this.permissionsRepo.findOne({
        where: { code: item.code },
      });
      if (!exists) {
        await this.permissionsRepo.save(
          this.permissionsRepo.create({
            code: item.code,
            name: item.name,
            description: item.description,
          }),
        );
      }
    }
  }

  private async seedAdminIfNeeded() {
    const adminCount = await this.usersRepo.count({
      where: { type: UserType.ADMIN },
    });
    if (adminCount > 0) {
      return;
    }

    const username = this.config.get<string>('ADMIN_USERNAME') ?? 'admin';
    const password = this.config.get<string>('ADMIN_PASSWORD') ?? 'AdminVd2026!';
    const fullName =
      this.config.get<string>('ADMIN_NAME') ?? 'Administrador Venta Digital';

    await this.createUser({
      type: UserType.ADMIN,
      fullName,
      username,
      password,
    });
  }

  async createUser(dto: CreateUserDto) {
    this.assertCreatePayload(dto);

    if (dto.type === UserType.VENDEDOR) {
      const exists = await this.usersRepo.findOne({
        where: { cellphone: dto.cellphone },
      });
      if (exists) {
        throw new ConflictException('Ya existe un usuario con ese celular');
      }
    } else {
      const exists = await this.usersRepo.findOne({
        where: { username: dto.username },
      });
      if (exists) {
        throw new ConflictException('Ya existe un usuario con ese username');
      }
    }

    const passwordHash =
      dto.password != null
        ? await bcrypt.hash(dto.password, 10)
        : null;

    const user = await this.usersRepo.save(
      this.usersRepo.create({
        type: dto.type,
        fullName: dto.fullName,
        cellphone: dto.cellphone ?? null,
        username: dto.username ?? null,
        passwordHash,
        active: true,
      }),
    );

    const codes = this.resolveDefaultPermissions(dto);
    await this.assignPermissions(user, codes);

    return this.findById(user.id);
  }

  async listUsers(type?: UserType) {
    const where = type ? { type } : {};
    const users = await this.usersRepo.find({
      where,
      relations: { userPermissions: { permission: true } },
      order: { id: 'ASC' },
    });

    return users.map((u) => this.toPublic(u));
  }

  async findById(id: number) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: { userPermissions: { permission: true } },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.toPublic(user);
  }

  async listPermissions() {
    return this.permissionsRepo.find({ order: { id: 'ASC' } });
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

    const permissions = await this.permissionsRepo.find({
      where: { code: In(codes) },
    });

    for (const permission of permissions) {
      await this.userPermissionsRepo.save(
        this.userPermissionsRepo.create({ user, permission }),
      );
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
