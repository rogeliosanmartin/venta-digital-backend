import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Configuración global (una sola fila, id = 1). */
@Entity({ name: 'app_settings' })
export class AppSettings {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  /** Máximo de borradores activos por vendedor. */
  @Column({ name: 'draft_limit', type: 'int', default: 3 })
  draftLimit!: number;

  /** Horas de vigencia de un borrador desde el último guardado. */
  @Column({ name: 'draft_ttl_hours', type: 'int', default: 24 })
  draftTtlHours!: number;

  /** Porcentaje máximo de descuento (0–100) que puede aplicar un vendedor (salvo especial). */
  @Column({
    name: 'max_discount_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  maxDiscountAmount!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
