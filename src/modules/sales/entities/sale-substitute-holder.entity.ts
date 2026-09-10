import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sale } from './sale.entity';

/** Titular sustituto (derechohabiente; distinto del titular/contacto y de beneficiarios). */
@Entity({ name: 'sale_substitute_holders' })
export class SaleSubstituteHolder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'sale_id', type: 'int', unique: true })
  saleId!: number;

  @OneToOne(() => Sale, (s) => s.substituteHolder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  @Column({ name: 'apellido_paterno', type: 'varchar', length: 80, default: '' })
  apellidoPaterno!: string;

  @Column({ name: 'apellido_materno', type: 'varchar', length: 80, default: '' })
  apellidoMaterno!: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  nombres!: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  parentesco!: string;

  /** Id Odoo `sale.order.relation` (`relation_id`). */
  @Column({ name: 'relation_id', type: 'int', nullable: true })
  relationId!: number | null;

  @Column({ type: 'varchar', length: 20, default: '' })
  celular!: string;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento!: string | null;
}
