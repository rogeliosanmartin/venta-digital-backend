import { Injectable, Logger } from '@nestjs/common';
import { AuditLogsRepository } from './repositories/audit-logs.repository';
import { AuditAction } from './enums/audit-action.enum';
import { AuditEntityType } from './enums/audit-entity-type.enum';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto';

export interface AuditActor {
  userId: number | null;
  fullName?: string | null;
  type?: string | null;
}

export interface RecordAuditInput {
  actor?: AuditActor | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: number | null;
  summary: string;
  details?: Record<string, unknown> | null;
}

/**
 * Compara objetos planos y devuelve solo campos que cambiaron.
 * No incluir passwords ni hashes.
 */
export function diffChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[key] = { from: from ?? null, to: to ?? null };
    }
  }

  return changes;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  /**
   * Registra un evento. No debe romper el flujo principal si falla el log.
   */
  async record(input: RecordAuditInput): Promise<void> {
    try {
      await this.auditLogsRepository.createAndSave({
        actorUserId: input.actor?.userId ?? null,
        actorName: input.actor?.fullName ?? null,
        actorType: input.actor?.type ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        details: input.details ?? null,
      });
    } catch (err) {
      this.logger.error(
        `No se pudo registrar audit log: ${input.summary}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  async list(query: ListAuditLogsQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const [items, total] = await this.auditLogsRepository.list({
      q: query.q,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      entityType: query.entityType,
      entityId: query.entityId,
      actorUserId: query.actorUserId,
      action: query.action,
      limit,
      offset,
    });

    return {
      items,
      total,
      limit,
      offset,
    };
  }
}
