import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sale } from './sale.entity';
import { DocumentKind } from '../enums/document-kind.enum';

@Entity({ name: 'sale_documents' })
export class SaleDocument {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'sale_id', type: 'int' })
  saleId!: number;

  @ManyToOne(() => Sale, (s) => s.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  @Column({ type: 'varchar', length: 20 })
  kind!: DocumentKind;

  @Column({ type: 'varchar', length: 220, default: '' })
  name!: string;

  @Column({ type: 'varchar', length: 120, default: 'application/octet-stream' })
  mime!: string;

  @Column({ name: 'data_base64', type: 'text' })
  dataBase64!: string;
}
