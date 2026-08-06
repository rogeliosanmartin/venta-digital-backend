import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sale } from './sale.entity';

/** Beneficiario / derechohabiente (sale.order.beneficiary en Odoo). */
@Entity({ name: 'sale_beneficiaries' })
export class SaleBeneficiary {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'sale_id', type: 'int' })
  saleId!: number;

  @ManyToOne(() => Sale, (s) => s.beneficiaries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  /** Orden de captura (0 = obligatorio, 1 = opcional). */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'apellido_paterno', type: 'varchar', length: 80, default: '' })
  apellidoPaterno!: string;

  @Column({ name: 'apellido_materno', type: 'varchar', length: 80, default: '' })
  apellidoMaterno!: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  nombres!: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  parentesco!: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  celular!: string;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento!: string | null;
}
