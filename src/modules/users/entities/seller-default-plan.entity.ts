import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SellerDefault } from './seller-default.entity';

export type SellerDefaultPlanKind = 'PLAN_FUTURO' | 'PARQUE';

/** Solo guarda la referencia al plan de Odoo. Precio y flags se leen al usarlo. */
@Entity({ name: 'seller_default_plans' })
@Index(['sellerDefaultId', 'planKind', 'productId'], { unique: true })
export class SellerDefaultPlan {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'seller_default_id', type: 'int' })
  sellerDefaultId!: number;

  @ManyToOne(() => SellerDefault, (defaults) => defaults.plans, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'seller_default_id' })
  sellerDefault!: SellerDefault;

  @Column({ name: 'plan_kind', type: 'varchar', length: 20 })
  planKind!: SellerDefaultPlanKind;

  @Column({ name: 'product_id', type: 'int' })
  productId!: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
