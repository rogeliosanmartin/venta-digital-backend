import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SellerDefaultPlan } from './seller-default-plan.entity';

/** Preferencias del vendedor: sucursal y planes predeterminados. */
@Entity({ name: 'seller_defaults' })
export class SellerDefault {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ name: 'seller_id', type: 'int' })
  sellerId!: number;

  @Column({ name: 'branch_id', type: 'int', nullable: true })
  branchId!: number | null;

  @Column({ name: 'branch_name', type: 'varchar', length: 180, nullable: true })
  branchName!: string | null;

  @OneToMany(() => SellerDefaultPlan, (plan) => plan.sellerDefault, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  plans!: SellerDefaultPlan[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
