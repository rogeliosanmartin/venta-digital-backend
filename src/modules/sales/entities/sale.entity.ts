import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SaleStatus } from '../enums/sale-status.enum';
import { PlanKind } from '../enums/plan-kind.enum';
import { SaleHolder } from './sale-holder.entity';
import { SaleSecondContact } from './sale-second-contact.entity';
import { SaleBeneficiary } from './sale-beneficiary.entity';
import { SaleDocument } from './sale-document.entity';

/**
 * Cotización / venta (sale.order en Odoo).
 * Campos tipados — sin JSON de formulario.
 */
@Entity({ name: 'sales' })
export class Sale {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'seller_id', type: 'int' })
  sellerId!: number;

  @Column({ name: 'seller_name', type: 'varchar', length: 180 })
  sellerName!: string;

  @Index()
  @Column({ type: 'varchar', length: 30, default: SaleStatus.DRAFT })
  status!: SaleStatus;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  amount!: string;

  @Column({ name: 'titular_name', type: 'varchar', length: 220, nullable: true })
  titularName!: string | null;

  // —— Meta / contrato ——
  @Column({ type: 'date', nullable: true })
  fecha!: string | null;

  @Column({ type: 'varchar', length: 80, default: '' })
  contrato!: string;

  @Column({ name: 'origen_venta', type: 'varchar', length: 80, default: '' })
  origenVenta!: string;

  /** Folio de solicitud = id de la venta (se sincroniza al guardar). */
  @Column({ name: 'folio_solicitud', type: 'varchar', length: 80, default: '' })
  folioSolicitud!: string;

  @Column({ name: 'fecha_servicio', type: 'date', nullable: true })
  fechaServicio!: string | null;

  @Column({ type: 'varchar', length: 40, default: 'ACTIVO' })
  estatus!: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  anterior!: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  verificacion!: string;

  // —— Plan ——
  @Column({ name: 'plan_kind', type: 'varchar', length: 20, default: PlanKind.PLAN_FUTURO })
  planKind!: PlanKind;

  @Column({ name: 'nombre_plan', type: 'varchar', length: 180, default: '' })
  nombrePlan!: string;

  /** Id product.template en Odoo */
  @Column({ name: 'product_id', type: 'int', nullable: true })
  productId!: number | null;

  /** Id res.partner en Odoo (cliente asociado desde Mesa de Control) */
  @Column({ name: 'odoo_partner_id', type: 'int', nullable: true })
  odooPartnerId!: number | null;

  /** Id sale.order en Odoo (cotización generada desde Conciliación) */
  @Column({ name: 'odoo_sale_order_id', type: 'int', nullable: true })
  odooSaleOrderId!: number | null;

  /** Referencia interna Odoo (`default_code`) — solo informativo */
  @Column({ name: 'product_default_code', type: 'varchar', length: 80, default: '' })
  productDefaultCode!: string;

  @Column({ name: 'servicio_funerario', type: 'varchar', length: 180, default: '' })
  servicioFunerario!: string;

  // —— Ubicación (solo PARQUE) ——
  @Column({ type: 'varchar', length: 40, default: '' })
  seccion!: string;

  @Column({ type: 'varchar', length: 40, default: '' })
  cuadrante!: string;

  @Column({ type: 'varchar', length: 40, default: '' })
  numero!: string;

  @Column({ name: 'parque_funeral', type: 'varchar', length: 180, default: '' })
  parqueFuneral!: string;

  /** Ids Odoo para preasignación de ubicación (parque → espacio). */
  @Column({ name: 'park_id', type: 'int', nullable: true })
  parkId!: number | null;

  @Column({ name: 'section_id', type: 'int', nullable: true })
  sectionId!: number | null;

  @Column({ name: 'quadrant_id', type: 'int', nullable: true })
  quadrantId!: number | null;

  @Column({ name: 'space_id', type: 'int', nullable: true })
  spaceId!: number | null;

  /** Bandera: si es true, aplica ubicación (parque/sección/cuadrante/número) */
  @Column({ type: 'boolean', default: false })
  preasignacion!: boolean;

  // —— Pago (se llena en paso aparte) ——
  @Column({ name: 'precio_plan', type: 'varchar', length: 40, default: '' })
  precioPlan!: string;

  @Column({ type: 'varchar', length: 40, default: '' })
  frecuencia!: string;

  @Column({ name: 'promocion_descuento', type: 'varchar', length: 120, default: '' })
  promocionDescuento!: string;

  /** Grant de descuento especial consumido (si aplica). */
  @Column({ name: 'discount_grant_id', type: 'int', nullable: true })
  discountGrantId!: number | null;

  @Column({ type: 'varchar', length: 40, default: '' })
  anticipo!: string;

  @Column({ name: 'pago_inicial', type: 'varchar', length: 40, default: '' })
  pagoInicial!: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  plazo!: string;

  @Column({ name: 'importe_cada_pago', type: 'varchar', length: 40, default: '' })
  importeCadaPago!: string;

  @Column({ type: 'varchar', length: 40, default: '' })
  saldo!: string;

  @Column({ name: 'fecha_proximo_pago', type: 'date', nullable: true })
  fechaProximoPago!: string | null;

  @Column({ name: 'dias_especificos_pago', type: 'varchar', length: 80, default: '' })
  diasEspecificosPago!: string;

  @Column({ name: 'forma_pago', type: 'varchar', length: 40, default: '' })
  formaPago!: string;

  @Column({ type: 'varchar', length: 40, default: '' })
  cuenta!: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  banco!: string;

  /** Solo pago en efectivo: billetes recibidos y cambio entregado. */
  @Column({ name: 'monto_recibido', type: 'varchar', length: 40, default: '' })
  montoRecibido!: string;

  @Column({ type: 'varchar', length: 40, default: '' })
  cambio!: string;

  @Column({ name: 'nombre_asesor', type: 'varchar', length: 120, default: '' })
  nombreAsesor!: string;

  @Column({ name: 'nombre_jefe_ventas', type: 'varchar', length: 120, default: '' })
  nombreJefeVentas!: string;

  // —— Declaraciones ——
  @Column({ name: 'acepta_mercadotecnia', type: 'varchar', length: 10, default: '' })
  aceptaMercadotecnia!: string;

  @Column({ name: 'acepta_publicidad', type: 'varchar', length: 10, default: '' })
  aceptaPublicidad!: string;

  // —— Drive ——
  @Column({ name: 'drive_folder_id', type: 'varchar', length: 80, nullable: true })
  driveFolderId!: string | null;

  @Column({ name: 'drive_folder_url', type: 'varchar', length: 320, nullable: true })
  driveFolderUrl!: string | null;

  /** Ruta lógica: AÑO/MES/FOLIO-nombrecliente */
  @Column({ name: 'drive_folder_path', type: 'varchar', length: 320, nullable: true })
  driveFolderPath!: string | null;

  @Index()
  @Column({ name: 'draft_expires_at', type: 'timestamptz', nullable: true })
  draftExpiresAt!: Date | null;

  @OneToOne(() => SaleHolder, (h) => h.sale, { cascade: true })
  holder!: SaleHolder | null;

  @OneToOne(() => SaleSecondContact, (c) => c.sale, { cascade: true })
  secondContact!: SaleSecondContact | null;

  @OneToMany(() => SaleBeneficiary, (b) => b.sale, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  beneficiaries!: SaleBeneficiary[];

  @OneToMany(() => SaleDocument, (d) => d.sale, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  documents!: SaleDocument[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
