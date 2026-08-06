import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sale } from './sale.entity';

/** Segundo contacto del titular (campos second_contact_* en res.partner Odoo). */
@Entity({ name: 'sale_second_contacts' })
export class SaleSecondContact {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'sale_id', type: 'int', unique: true })
  saleId!: number;

  @OneToOne(() => Sale, (s) => s.secondContact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  @Column({ name: 'apellido_paterno', type: 'varchar', length: 80, default: '' })
  apellidoPaterno!: string;

  @Column({ name: 'apellido_materno', type: 'varchar', length: 80, default: '' })
  apellidoMaterno!: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  nombres!: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  celular!: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  parentesco!: string;

  @Column({ type: 'varchar', length: 220, default: '' })
  direccion!: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  colonia!: string;

  @Column({ type: 'varchar', length: 10, default: '' })
  cp!: string;

  @Column({ name: 'entre_calles', type: 'varchar', length: 220, default: '' })
  entreCalles!: string;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento!: string | null;

  @Column({
    name: 'domicilio_entrega_documentacion',
    type: 'varchar',
    length: 220,
    default: '',
  })
  domicilioEntregaDocumentacion!: string;
}
