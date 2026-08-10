import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from './entities/app-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { DiscountsService } from '../discounts/discounts.service';
import { AuditService, diffChanges } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';
import { AuditEntityType } from '../audit/enums/audit-entity-type.enum';
import { UsersRepository } from '../users/repositories/users.repository';
import { AuthUserPayload } from '../../common/decorators/current-user.decorator';

const SETTINGS_ID = 1;
const DEFAULT_DRAFT_LIMIT = 3;
const DEFAULT_DRAFT_TTL_HOURS = 24;
const DEFAULT_MAX_DISCOUNT = 0;

function moneyNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(AppSettings)
    private readonly repo: Repository<AppSettings>,
    private readonly discountsService: DiscountsService,
    private readonly auditService: AuditService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  async ensureDefaults() {
    const existing = await this.repo.findOne({ where: { id: SETTINGS_ID } });
    if (existing) return existing;

    const row = this.repo.create({
      id: SETTINGS_ID,
      draftLimit: DEFAULT_DRAFT_LIMIT,
      draftTtlHours: DEFAULT_DRAFT_TTL_HOURS,
      maxDiscountAmount: String(DEFAULT_MAX_DISCOUNT),
    });
    return this.repo.save(row);
  }

  async get(): Promise<AppSettings> {
    const row = await this.repo.findOne({ where: { id: SETTINGS_ID } });
    if (row) return row;
    return this.ensureDefaults();
  }

  async getDraftPolicy() {
    const s = await this.get();
    return {
      draftLimit: s.draftLimit,
      draftTtlHours: s.draftTtlHours,
    };
  }

  /** Política de captura para el vendedor (borradores + tope de descuento). */
  async getSellerCapturePolicy(userId: number) {
    const s = await this.get();
    const maxDiscountAmount = moneyNum(s.maxDiscountAmount);
    const descuentoEspecial =
      await this.discountsService.activeSpecialMaxForSeller(userId);
    return {
      draftLimit: s.draftLimit,
      draftTtlHours: s.draftTtlHours,
      maxDiscountAmount,
      descuentoEspecial,
      allowedDiscountMax: Math.max(maxDiscountAmount, descuentoEspecial),
    };
  }

  async allowedDiscountMaxForUser(userId: number): Promise<number> {
    const policy = await this.getSellerCapturePolicy(userId);
    return policy.allowedDiscountMax;
  }

  async getGlobalMaxDiscount(): Promise<number> {
    const s = await this.get();
    return moneyNum(s.maxDiscountAmount);
  }

  async update(
    dto: UpdateSettingsDto,
    actor?: AuthUserPayload | null,
  ): Promise<AppSettings> {
    const row = await this.get();
    const before = {
      draftLimit: row.draftLimit,
      draftTtlHours: row.draftTtlHours,
      maxDiscountAmount: moneyNum(row.maxDiscountAmount),
    };

    row.draftLimit = dto.draftLimit;
    row.draftTtlHours = dto.draftTtlHours;
    row.maxDiscountAmount = String(dto.maxDiscountAmount ?? 0);
    const saved = await this.repo.save(row);

    const after = {
      draftLimit: saved.draftLimit,
      draftTtlHours: saved.draftTtlHours,
      maxDiscountAmount: moneyNum(saved.maxDiscountAmount),
    };
    const changes = diffChanges(before, after);

    if (Object.keys(changes).length && actor) {
      const actorUser = await this.usersRepository.findById(actor.userId);
      const actorName = actorUser?.fullName ?? 'Administrador';
      await this.auditService.record({
        actor: {
          userId: actor.userId,
          fullName: actorName,
          type: actor.type,
        },
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.SETTINGS,
        entityId: SETTINGS_ID,
        summary: `${actorName} actualizó la configuración del sistema`,
        details: { changes },
      });
    }

    return saved;
  }

  toPublic(s: AppSettings) {
    return {
      draftLimit: s.draftLimit,
      draftTtlHours: s.draftTtlHours,
      maxDiscountAmount: moneyNum(s.maxDiscountAmount),
      updatedAt: s.updatedAt?.toISOString() ?? null,
    };
  }
}
