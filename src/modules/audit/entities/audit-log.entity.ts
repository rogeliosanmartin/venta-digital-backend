import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditAction } from '../enums/audit-action.enum';
import { AuditEntityType } from '../enums/audit-entity-type.enum';

/**
 * Bitácora de transacciones / auditoría.
 * Ejemplo: "Admin X dio de alta al vendedor Y" o "cambió el celular de A a B".
 */
@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'actor_user_id', type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ name: 'actor_name', type: 'varchar', length: 150, nullable: true })
  actorName: string | null;

  @Column({ name: 'actor_type', type: 'varchar', length: 20, nullable: true })
  actorType: string | null;

  @Column({ type: 'varchar', length: 30 })
  action: AuditAction;

  @Index()
  @Column({ name: 'entity_type', type: 'varchar', length: 30 })
  entityType: AuditEntityType;

  @Index()
  @Column({ name: 'entity_id', type: 'int', nullable: true })
  entityId: number | null;

  /** Texto legible en español para listados. */
  @Column({ type: 'varchar', length: 500 })
  summary: string;

  /**
   * Detalle de cambios.
   * - CREATE: { after: {...} }
   * - UPDATE: { changes: { campo: { from, to } } }
   */
  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
