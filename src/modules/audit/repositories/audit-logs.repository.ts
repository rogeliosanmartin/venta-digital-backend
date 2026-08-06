import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditAction } from '../enums/audit-action.enum';
import { AuditEntityType } from '../enums/audit-entity-type.enum';

export interface AuditLogCreateInput {
  actorUserId: number | null;
  actorName: string | null;
  actorType: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: number | null; 
  summary: string;
  details?: Record<string, unknown> | null;
}

export interface AuditLogListFilter {
  q?: string;
  /** YYYY-MM-DD en zona de negocio Mexico */
  dateFrom?: string;
  /** YYYY-MM-DD en zona de negocio Mexico */
  dateTo?: string;
  entityType?: AuditEntityType;
  entityId?: number;
  actorUserId?: number;
  action?: AuditAction;
  limit: number;
  offset: number;
}

/** Consultas a `audit_logs`. Sin lógica de negocio. */
@Injectable()
export class AuditLogsRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  createAndSave(data: AuditLogCreateInput): Promise<AuditLog> {
    return this.repo.save(
      this.repo.create({
        actorUserId: data.actorUserId,
        actorName: data.actorName,
        actorType: data.actorType,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        summary: data.summary,
        details: data.details ?? null,
      }),
    );
  }

  async list(filter: AuditLogListFilter): Promise<[AuditLog[], number]> {
    const qb = this.repo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .take(filter.limit)
      .skip(filter.offset);

    if (filter.entityType) {
      qb.andWhere('log.entityType = :entityType', {
        entityType: filter.entityType,
      });
    }
    if (filter.entityId != null) {
      qb.andWhere('log.entityId = :entityId', { entityId: filter.entityId });
    }
    if (filter.actorUserId != null) {
      qb.andWhere('log.actorUserId = :actorUserId', {
        actorUserId: filter.actorUserId,
      });
    }
    if (filter.action) {
      qb.andWhere('log.action = :action', { action: filter.action });
    }

    // Fechas calendario en America/Mexico_City (negocio GSM)
    if (filter.dateFrom) {
      qb.andWhere(
        `(timezone('America/Mexico_City', log.createdAt))::date >= :dateFrom::date`,
        { dateFrom: filter.dateFrom },
      );
    }
    if (filter.dateTo) {
      qb.andWhere(
        `(timezone('America/Mexico_City', log.createdAt))::date <= :dateTo::date`,
        { dateTo: filter.dateTo },
      );
    }

    const keyword = filter.q?.trim();
    if (keyword) {
      const escaped = keyword
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      const q = `%${escaped}%`;
      qb.andWhere(
        `(
          log.summary ILIKE :q ESCAPE '\\'
          OR COALESCE(log.actorName, '') ILIKE :q ESCAPE '\\'
          OR COALESCE(log.actorType, '') ILIKE :q ESCAPE '\\'
          OR log.action ILIKE :q ESCAPE '\\'
          OR log.entityType ILIKE :q ESCAPE '\\'
          OR CAST(log.details AS text) ILIKE :q ESCAPE '\\'
        )`,
        { q },
      );
    }

    return qb.getManyAndCount();
  }
}
