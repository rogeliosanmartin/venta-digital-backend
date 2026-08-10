import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DiscountGrantStatus } from '../enums/discount-grant-status.enum';

/** Autorización de descuento especial a un vendedor. */
@Entity({ name: 'discount_grants' })
export class DiscountGrant {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'seller_id', type: 'int' })
  sellerId!: number;

  @Column({ name: 'seller_name', type: 'varchar', length: 150 })
  sellerName!: string;

  /** Porcentaje autorizado (0–100). */
  @Column({ type: 'numeric', precision: 5, scale: 2 })
  percent!: string;

  @Column({ type: 'varchar', length: 20, default: DiscountGrantStatus.ACTIVE })
  status!: DiscountGrantStatus;

  @Column({ name: 'created_by_user_id', type: 'int' })
  createdByUserId!: number;

  @Column({ name: 'created_by_name', type: 'varchar', length: 150 })
  createdByName!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'cancelled_by_user_id', type: 'int', nullable: true })
  cancelledByUserId!: number | null;

  @Column({ name: 'cancelled_by_name', type: 'varchar', length: 150, nullable: true })
  cancelledByName!: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'applied_sale_id', type: 'int', nullable: true })
  appliedSaleId!: number | null;

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt!: Date | null;
}
