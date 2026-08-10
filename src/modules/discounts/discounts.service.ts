import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscountGrant } from './entities/discount-grant.entity';
import { DiscountGrantStatus } from './enums/discount-grant-status.enum';
import { CreateDiscountGrantDto } from './dto/create-discount-grant.dto';
import { UsersRepository } from '../users/repositories/users.repository';
import { UserType } from '../../common/enums/user-type.enum';
import { AuthUserPayload } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';
import { AuditEntityType } from '../audit/enums/audit-entity-type.enum';

@Injectable()
export class DiscountsService {
  constructor(
    @InjectRepository(DiscountGrant)
    private readonly repo: Repository<DiscountGrant>,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  private toPublic(g: DiscountGrant) {
    return {
      id: g.id,
      sellerId: g.sellerId,
      sellerName: g.sellerName,
      percent: Number(g.percent) || 0,
      status: g.status,
      createdByUserId: g.createdByUserId,
      createdByName: g.createdByName,
      createdAt: g.createdAt?.toISOString() ?? null,
      cancelledByUserId: g.cancelledByUserId,
      cancelledByName: g.cancelledByName,
      cancelledAt: g.cancelledAt?.toISOString() ?? null,
      appliedSaleId: g.appliedSaleId,
      appliedAt: g.appliedAt?.toISOString() ?? null,
    };
  }

  private toSnapshot(g: DiscountGrant) {
    return {
      sellerId: g.sellerId,
      sellerName: g.sellerName,
      percent: Number(g.percent) || 0,
      status: g.status,
      createdByName: g.createdByName,
      cancelledByName: g.cancelledByName,
      appliedSaleId: g.appliedSaleId,
    };
  }

  async list() {
    const rows = await this.repo.find({ order: { id: 'DESC' } });
    return rows.map((g) => this.toPublic(g));
  }

  async create(dto: CreateDiscountGrantDto, actor: AuthUserPayload) {
    const seller = await this.usersRepository.findById(dto.sellerId);
    if (!seller || seller.type !== UserType.VENDEDOR) {
      throw new BadRequestException('Selecciona un vendedor válido');
    }
    if (!seller.active) {
      throw new BadRequestException('El vendedor está inactivo');
    }

    const actorUser = await this.usersRepository.findById(actor.userId);
    const actorName = actorUser?.fullName ?? 'Administrador';
    const row = this.repo.create({
      sellerId: seller.id,
      sellerName: seller.fullName,
      percent: String(dto.percent),
      status: DiscountGrantStatus.ACTIVE,
      createdByUserId: actor.userId,
      createdByName: actorName,
      cancelledByUserId: null,
      cancelledByName: null,
      cancelledAt: null,
      appliedSaleId: null,
      appliedAt: null,
    });
    const saved = await this.repo.save(row);

    await this.auditService.record({
      actor: {
        userId: actor.userId,
        fullName: actorName,
        type: actor.type,
      },
      action: AuditAction.CREATE,
      entityType: AuditEntityType.DISCOUNT,
      entityId: saved.id,
      summary: `${actorName} autorizó descuento especial de ${dto.percent}% a ${seller.fullName}`,
      details: { after: this.toSnapshot(saved) },
    });

    return this.toPublic(saved);
  }

  async cancel(id: number, actor: AuthUserPayload) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Descuento no encontrado');
    if (row.status === DiscountGrantStatus.APPLIED) {
      throw new BadRequestException(
        'Este descuento ya fue aplicado en una venta y no se puede cancelar',
      );
    }
    if (row.status === DiscountGrantStatus.CANCELLED) {
      throw new BadRequestException('Este descuento ya está cancelado');
    }

    const before = this.toSnapshot(row);
    const actorUser = await this.usersRepository.findById(actor.userId);
    const actorName = actorUser?.fullName ?? 'Administrador';
    row.status = DiscountGrantStatus.CANCELLED;
    row.cancelledByUserId = actor.userId;
    row.cancelledByName = actorName;
    row.cancelledAt = new Date();
    const saved = await this.repo.save(row);

    await this.auditService.record({
      actor: {
        userId: actor.userId,
        fullName: actorName,
        type: actor.type,
      },
      action: AuditAction.CANCEL,
      entityType: AuditEntityType.DISCOUNT,
      entityId: saved.id,
      summary: `${actorName} canceló descuento especial de ${saved.percent}% a ${saved.sellerName}`,
      details: {
        before,
        after: this.toSnapshot(saved),
      },
    });

    return this.toPublic(saved);
  }

  /** Mayor % activo autorizado al vendedor. */
  async activeSpecialMaxForSeller(sellerId: number): Promise<number> {
    const rows = await this.repo.find({
      where: { sellerId, status: DiscountGrantStatus.ACTIVE },
    });
    if (!rows.length) return 0;
    return Math.max(...rows.map((r) => Number(r.percent) || 0));
  }

  /**
   * Consume un grant activo que cubra el % solicitado.
   * Devuelve el id del grant o null si no se requiere (descuento ≤ tope global).
   */
  async consumeForSale(
    sellerId: number,
    discountPct: number,
    globalMax: number,
    saleId: number,
    actor?: AuthUserPayload | null,
  ): Promise<number | null> {
    if (discountPct <= globalMax + 0.001) return null;

    const rows = await this.repo.find({
      where: { sellerId, status: DiscountGrantStatus.ACTIVE },
    });
    rows.sort(
      (a, b) =>
        (Number(a.percent) || 0) - (Number(b.percent) || 0) || a.id - b.id,
    );
    const grant = rows.find((r) => Number(r.percent) + 0.001 >= discountPct);
    if (!grant) {
      throw new BadRequestException(
        `No hay un descuento especial activo que cubra ${discountPct}%`,
      );
    }

    const before = this.toSnapshot(grant);
    grant.status = DiscountGrantStatus.APPLIED;
    grant.appliedSaleId = saleId;
    grant.appliedAt = new Date();
    await this.repo.save(grant);

    const actorUser = actor
      ? await this.usersRepository.findById(actor.userId)
      : null;
    const actorName =
      actorUser?.fullName ?? grant.sellerName ?? 'Vendedor';

    await this.auditService.record({
      actor: {
        userId: actor?.userId ?? sellerId,
        fullName: actorName,
        type: actor?.type ?? UserType.VENDEDOR,
      },
      action: AuditAction.APPLY,
      entityType: AuditEntityType.DISCOUNT,
      entityId: grant.id,
      summary: `${actorName} aplicó descuento especial de ${grant.percent}% en venta #${saleId}`,
      details: {
        before,
        after: this.toSnapshot(grant),
        saleId,
        discountPct,
      },
    });

    return grant.id;
  }
}
