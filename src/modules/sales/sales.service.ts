import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SalesRepository } from './repositories/sales.repository';
import { SaleStatus } from './enums/sale-status.enum';
import { DocumentKind } from './enums/document-kind.enum';
import { UsersRepository } from '../users/repositories/users.repository';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';
import { AuditEntityType } from '../audit/enums/audit-entity-type.enum';
import { Sale } from './entities/sale.entity';
import { AuthUserPayload } from '../../common/decorators/current-user.decorator';
import { UserType } from '../../common/enums/user-type.enum';
import { GoogleDriveService } from './google-drive.service';
import {
  SavePaymentDto,
  SignSaleDto,
  UpsertSaleDto,
} from './dto/sale-form.dto';
import {
  applyPayloadToSale,
  computeSaldo,
  fullName,
  saleToAuditSnapshot,
  saleToPayload,
  saleToPublic,
} from './mappers/sale.mapper';
import { assertValidCurp } from './utils/curp';
import { SaleDocument } from './entities/sale-document.entity';
import { SettingsService } from '../settings/settings.service';
import { DiscountsService } from '../discounts/discounts.service';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly salesRepository: SalesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
    private readonly googleDrive: GoogleDriveService,
    private readonly settingsService: SettingsService,
    private readonly discountsService: DiscountsService,
  ) {}

  private parseMoney(v: unknown): number {
    const n = Number(String(v ?? '').replace(/,/g, '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  /** Valida tope de descuento (%) del vendedor y recalcula saldo. */
  private async assertDiscountAndSaldo(sale: Sale, userId: number) {
    const descuento = this.parseMoney(sale.promocionDescuento);
    if (descuento < 0) {
      throw new BadRequestException('El descuento no puede ser negativo');
    }
    if (descuento > 100) {
      throw new BadRequestException('El descuento no puede ser mayor a 100%');
    }
    const max = await this.settingsService.allowedDiscountMaxForUser(userId);
    if (descuento > max + 0.001) {
      throw new BadRequestException(
        `El descuento no puede exceder ${max}%`,
      );
    }
    this.recomputeSaldo(sale);
  }

  /** Recalcula saldo sin revalidar tope (p. ej. pago ya validado al finalizar). */
  private recomputeSaldo(sale: Sale) {
    sale.saldo = computeSaldo(
      sale.precioPlan,
      sale.promocionDescuento,
      sale.anticipo,
    );
  }

  /** Folio de solicitud = id de venta (consecutivo natural de la tabla). */
  private async syncFolioSolicitud(saleId: number) {
    const sale = await this.salesRepository.findById(saleId);
    if (!sale) return;
    const folio = String(saleId);
    if (sale.folioSolicitud === folio) return;
    sale.folioSolicitud = folio;
    await this.salesRepository.save(sale);
  }

  private async draftExpiry(from = new Date()) {
    const { draftTtlHours } = await this.settingsService.getDraftPolicy();
    return new Date(from.getTime() + draftTtlHours * 60 * 60 * 1000);
  }

  private assertSellerOwns(sale: Sale, userId: number) {
    if (sale.sellerId !== userId) {
      throw new ForbiddenException('No puedes acceder a esta venta');
    }
  }

  private async purgeExpired() {
    await this.salesRepository.deleteExpiredDrafts(new Date());
  }

  private validateCapture(payload: UpsertSaleDto['payload'], strictDocs: boolean) {
    try {
      assertValidCurp(payload.contacto?.curp);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const bens = payload.beneficiarios ?? [];
    const first = bens[0];
    if (!first || (!first.nombres?.trim() && !first.apellidoPaterno?.trim())) {
      throw new BadRequestException('Debes capturar al menos un beneficiario');
    }
    if (bens.length > 2) {
      throw new BadRequestException('Solo puedes agregar hasta 2 beneficiarios');
    }

    if (strictDocs) {
      if (!payload.documentos?.ine || !payload.documentos?.comprobanteDomicilio) {
        throw new BadRequestException(
          'Debes adjuntar INE y comprobante de domicilio',
        );
      }
    }
  }

  async listOwnSales(sellerId: number) {
    await this.purgeExpired();
    const items = await this.salesRepository.findBySellerId(sellerId);
    const now = Date.now();
    const visible = items.filter((s) => {
      if (s.status === SaleStatus.DRAFT) {
        return !s.draftExpiresAt || s.draftExpiresAt.getTime() > now;
      }
      return true;
    });
    const drafts = visible.filter((s) => s.status === SaleStatus.DRAFT);
    const pipeline = visible.filter((s) => s.status !== SaleStatus.DRAFT);
    const { draftLimit, draftTtlHours } =
      await this.settingsService.getDraftPolicy();

    return {
      scope: 'own' as const,
      items: visible.map(saleToPublic),
      drafts: drafts.map(saleToPublic),
      submitted: pipeline.map(saleToPublic),
      draftCount: drafts.length,
      draftLimit,
      draftTtlHours,
      total: visible.length,
      message:
        visible.length === 0
          ? 'Aún no hay ventas registradas para este vendedor'
          : 'Ventas y borradores del vendedor',
    };
  }

  async listAllSales() {
    await this.purgeExpired();
    const items = await this.salesRepository.findCompleted();
    return {
      scope: 'all' as const,
      items: items.map(saleToPublic),
      total: items.length,
      message:
        items.length === 0
          ? 'Aún no hay ventas registradas de vendedores'
          : 'Ventas de todos los vendedores',
    };
  }

  /**
   * Listado liviano para conciliación Odoo (sin adjuntos/base64).
   * Misma fuente que el monitor: pagos / firma / completadas.
   */
  async listForConciliation() {
    await this.purgeExpired();
    const items = await this.salesRepository.findCompleted();
    return {
      scope: 'conciliation' as const,
      total: items.length,
      items: items.map((s) => ({
        id: s.id,
        sellerId: s.sellerId,
        sellerName: s.sellerName,
        status: s.status,
        titularName: s.titularName,
        odooPartnerId: s.odooPartnerId ?? null,
        odooSaleOrderId: s.odooSaleOrderId ?? null,
        contrato: s.contrato ?? '',
        nombrePlan: s.nombrePlan ?? '',
        productDefaultCode: s.productDefaultCode ?? '',
        precioPlan: s.precioPlan ?? '',
        promocionDescuento: s.promocionDescuento ?? '',
        anticipo: s.anticipo ?? '',
        saldo: s.saldo ?? '',
        amount: Number(s.amount) || 0,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    };
  }

  async listReferences(sellerId: number) {
    await this.purgeExpired();
    const items = await this.salesRepository.findBySellerId(sellerId);
    const now = Date.now();
    return items
      .filter((s) => {
        if (s.status === SaleStatus.DRAFT) {
          return s.draftExpiresAt ? s.draftExpiresAt.getTime() > now : true;
        }
        return true;
      })
      .map((s) => ({
        id: s.id,
        status: s.status,
        titularName: s.titularName,
        amount: Number(s.amount) || 0,
        updatedAt: s.updatedAt.toISOString(),
        payload: saleToPayload(s),
      }));
  }

  /**
   * Si la firma ya no tiene base64 (ventas firmadas antes del fix),
   * la recupera desde Drive para la vista previa del PDF.
   */
  private async hydrateFirmaForPreview(sale: Sale) {
    const firma = (sale.documents ?? []).find(
      (d) => d.kind === DocumentKind.FIRMA,
    );
    if (!firma || firma.dataBase64?.trim() || !firma.driveFileId) return;
    if (!this.googleDrive.isEnabled()) return;

    const downloaded = await this.googleDrive.downloadFileBase64(
      firma.driveFileId,
    );
    if (!downloaded) return;

    firma.dataBase64 = downloaded.dataBase64;
    if (downloaded.mime) firma.mime = downloaded.mime;
    await this.salesRepository.save(sale);
  }

  /** Ventas ya firmadas: la carátula está en Drive pero no quedó en sale_documents. */
  private async ensureCaratulaFromDrive(sale: Sale) {
    const hasCaratula = sale.documents?.some(
      (d) => d.kind === DocumentKind.CARATULA,
    );
    if (hasCaratula || !sale.driveFolderId) return;

    const found = await this.googleDrive.findCaratulaInFolder(
      sale.driveFolderId,
      sale.id,
    );
    if (!found) return;

    const doc = new SaleDocument();
    doc.kind = DocumentKind.CARATULA;
    doc.name = found.name;
    doc.mime = 'application/pdf';
    doc.driveFileId = found.id;
    doc.driveFileUrl = found.url;
    doc.dataBase64 = null;
    sale.documents = [...(sale.documents ?? []), doc];
    await this.salesRepository.save(sale);
  }

  /** Recupera base64 de todos los adjuntos faltantes (p. ej. para Odoo). */
  private async hydrateAllDocuments(sale: Sale) {
    if (!this.googleDrive.isEnabled()) return;
    let changed = false;
    for (const doc of sale.documents ?? []) {
      if (doc.dataBase64?.trim() || !doc.driveFileId) continue;
      const downloaded = await this.googleDrive.downloadFileBase64(
        doc.driveFileId,
      );
      if (!downloaded) continue;
      doc.dataBase64 = downloaded.dataBase64;
      if (downloaded.mime) doc.mime = downloaded.mime;
      changed = true;
    }
    if (changed) {
      await this.salesRepository.save(sale);
    }
  }

  async getOne(id: number, user: AuthUserPayload) {
    await this.purgeExpired();
    const sale = await this.salesRepository.findById(id);
    if (!sale) throw new NotFoundException('Venta no encontrada');

    if (user.type === UserType.VENDEDOR) {
      this.assertSellerOwns(sale, user.userId);
      if (
        sale.status === SaleStatus.DRAFT &&
        sale.draftExpiresAt &&
        sale.draftExpiresAt.getTime() <= Date.now()
      ) {
        throw new NotFoundException('El borrador ya expiró');
      }
    }

    await this.hydrateFirmaForPreview(sale);
    return saleToPublic(sale);
  }

  /** Detalle completo para Conciliación Odoo (payload + archivos). */
  async getOneForOdoo(id: number) {
    await this.purgeExpired();
    const sale = await this.salesRepository.findById(id);
    if (!sale) throw new NotFoundException('Venta no encontrada');
    await this.ensureCaratulaFromDrive(sale);
    await this.hydrateAllDocuments(sale);
    return saleToPublic(sale);
  }

  /** Asocia un res.partner de Odoo a la venta (Mesa de Control). */
  async setOdooPartner(id: number, odooPartnerId: number) {
    await this.purgeExpired();
    const sale = await this.salesRepository.findById(id);
    if (!sale) throw new NotFoundException('Venta no encontrada');
    sale.odooPartnerId = odooPartnerId;
    await this.salesRepository.save(sale);
    return {
      id: sale.id,
      odooPartnerId: sale.odooPartnerId,
    };
  }

  /** Asocia la cotización sale.order creada desde Mesa de Control. */
  async setOdooSaleOrder(id: number, odooSaleOrderId: number) {
    await this.purgeExpired();
    const sale = await this.salesRepository.findById(id);
    if (!sale) throw new NotFoundException('Venta no encontrada');
    if (!sale.odooPartnerId) {
      throw new BadRequestException(
        'La venta debe tener un cliente Odoo asociado',
      );
    }
    if (
      sale.odooSaleOrderId &&
      sale.odooSaleOrderId !== odooSaleOrderId
    ) {
      throw new ConflictException(
        `La venta ya está asociada a la cotización Odoo ${sale.odooSaleOrderId}`,
      );
    }
    sale.odooSaleOrderId = odooSaleOrderId;
    await this.salesRepository.save(sale);
    return {
      id: sale.id,
      odooSaleOrderId: sale.odooSaleOrderId,
    };
  }

  async createDraft(user: AuthUserPayload, dto: UpsertSaleDto) {
    await this.purgeExpired();
    const now = new Date();
    const { draftLimit } = await this.settingsService.getDraftPolicy();
    const count = await this.salesRepository.countActiveDrafts(user.userId, now);
    if (count >= draftLimit) {
      throw new BadRequestException(
        `Solo puedes tener ${draftLimit} borradores. Elimina o envía uno antes de crear otro.`,
      );
    }

    if (dto.payload.contacto?.curp?.trim()) {
      try {
        assertValidCurp(dto.payload.contacto.curp);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    }

    const seller = await this.usersRepository.findById(user.userId);
    const sale = this.salesRepository.create();
    sale.sellerId = user.userId;
    sale.sellerName = seller?.fullName ?? 'Vendedor';
    sale.status = SaleStatus.DRAFT;
    sale.amount = '0';
    sale.draftExpiresAt = await this.draftExpiry(now);
    applyPayloadToSale(sale, dto.payload);
    await this.assertDiscountAndSaldo(sale, user.userId);
    if (dto.titularName?.trim()) sale.titularName = dto.titularName.trim();

    const saved = await this.salesRepository.save(sale);
    await this.syncFolioSolicitud(saved.id);
    const full = (await this.salesRepository.findById(saved.id))!;
    const titular =
      full.titularName || (full.holder ? fullName(full.holder) : '') || 'sin titular';

    await this.auditService.record({
      actor: {
        userId: user.userId,
        fullName: seller?.fullName,
        type: user.type,
      },
      action: AuditAction.CREATE,
      entityType: AuditEntityType.SALE,
      entityId: saved.id,
      summary: `${seller?.fullName ?? 'Vendedor'} guardó borrador de venta #${saved.id} (${titular})`,
      details: { after: saleToAuditSnapshot(full) },
    });

    return saleToPublic(full);
  }

  async updateDraft(id: number, user: AuthUserPayload, dto: UpsertSaleDto) {
    await this.purgeExpired();
    const sale = await this.salesRepository.findById(id);
    if (!sale) throw new NotFoundException('Venta no encontrada');
    this.assertSellerOwns(sale, user.userId);
    if (sale.status !== SaleStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden editar borradores');
    }
    if (sale.draftExpiresAt && sale.draftExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('El borrador ya expiró');
    }

    if (dto.payload.contacto?.curp?.trim()) {
      try {
        assertValidCurp(dto.payload.contacto.curp);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    }

    applyPayloadToSale(sale, dto.payload);
    await this.assertDiscountAndSaldo(sale, user.userId);
    if (dto.titularName?.trim()) sale.titularName = dto.titularName.trim();
    sale.draftExpiresAt = await this.draftExpiry();
    sale.folioSolicitud = String(sale.id);
    await this.salesRepository.save(sale);
    return saleToPublic((await this.salesRepository.findById(id))!);
  }

  /** Finaliza captura → pendiente de pago (sin pago ni firma en el formulario). */
  async finalizeCapture(
    id: number | null,
    user: AuthUserPayload,
    dto: UpsertSaleDto,
  ) {
    await this.purgeExpired();
    this.validateCapture(dto.payload, true);

    const seller = await this.usersRepository.findById(user.userId);
    let sale: Sale;

    if (id != null) {
      const existing = await this.salesRepository.findById(id);
      if (!existing) throw new NotFoundException('Venta no encontrada');
      this.assertSellerOwns(existing, user.userId);
      if (existing.status !== SaleStatus.DRAFT) {
        throw new BadRequestException('Esta venta ya no es un borrador');
      }
      sale = existing;
    } else {
      const { draftLimit } = await this.settingsService.getDraftPolicy();
      const count = await this.salesRepository.countActiveDrafts(
        user.userId,
        new Date(),
      );
      if (count >= draftLimit) {
        throw new BadRequestException(
          `Solo puedes tener ${draftLimit} borradores activos`,
        );
      }
      sale = this.salesRepository.create();
      sale.sellerId = user.userId;
      sale.sellerName = seller?.fullName ?? 'Vendedor';
      sale.amount = '0';
    }

    applyPayloadToSale(sale, dto.payload);
    await this.assertDiscountAndSaldo(sale, user.userId);
    sale.status = SaleStatus.PENDING_PAYMENT;
    sale.draftExpiresAt = null;
    sale.titularName =
      dto.titularName?.trim() ||
      (sale.holder ? fullName(sale.holder) : sale.titularName);

    const saved = await this.salesRepository.save(sale);
    await this.syncFolioSolicitud(saved.id);

    const discountPct = this.parseMoney(saved.promocionDescuento);
    const globalMax = await this.settingsService.getGlobalMaxDiscount();
    const grantId = await this.discountsService.consumeForSale(
      user.userId,
      discountPct,
      globalMax,
      saved.id,
      user,
    );
    if (grantId != null) {
      saved.discountGrantId = grantId;
      await this.salesRepository.save(saved);
    }

    const full = (await this.salesRepository.findById(saved.id))!;
    const titular =
      full.titularName || (full.holder ? fullName(full.holder) : '') || 'sin titular';

    await this.auditService.record({
      actor: {
        userId: user.userId,
        fullName: seller?.fullName,
        type: user.type,
      },
      action: id != null ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: AuditEntityType.SALE,
      entityId: saved.id,
      summary: `${seller?.fullName ?? 'Vendedor'} finalizó captura de venta #${saved.id} (${titular})`,
      details: { after: saleToAuditSnapshot(full) },
    });

    return saleToPublic(full);
  }

  async savePayment(id: number, user: AuthUserPayload, dto: SavePaymentDto) {
    const sale = await this.salesRepository.findById(id);
    if (!sale) throw new NotFoundException('Venta no encontrada');
    this.assertSellerOwns(sale, user.userId);
    if (sale.status !== SaleStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        'Solo se puede registrar pago en ventas pendientes de pago',
      );
    }

    const p = dto.pago;

    // Financiamiento ya quedó validado al finalizar la captura; aquí solo pago.
    sale.formaPago = (p.formaPago ?? '').trim();
    sale.cuenta = (p.cuenta ?? '').trim();
    sale.banco = (p.banco ?? '').trim();
    sale.nombreJefeVentas = (p.nombreJefeVentas ?? '').trim();

    const forma = sale.formaPago.toUpperCase();
    if (!['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE'].includes(forma)) {
      throw new BadRequestException('Indica una forma de pago válida');
    }

    const anticipoNum = Number(
      String(sale.anticipo).replace(/[^0-9.-]/g, ''),
    );
    if (!Number.isFinite(anticipoNum) || anticipoNum <= 0) {
      throw new BadRequestException(
        'La venta debe tener un anticipo válido para registrar el pago',
      );
    }

    if (!sale.precioPlan) {
      throw new BadRequestException('Indica el precio del plan');
    }

    if (forma === 'EFECTIVO') {
      sale.cuenta = '';
      sale.banco = '';
      sale.montoRecibido = (p.montoRecibido ?? '').trim();
      if (!sale.montoRecibido) {
        throw new BadRequestException('Indica el efectivo recibido');
      }
      const received = Number(
        String(sale.montoRecibido).replace(/[^0-9.-]/g, ''),
      );
      if (!Number.isFinite(received) || received <= 0) {
        throw new BadRequestException('El efectivo recibido no es válido');
      }
      if (received < anticipoNum) {
        throw new BadRequestException(
          'El efectivo recibido debe cubrir el anticipo',
        );
      }
      sale.cambio = String(
        Number(Math.max(0, received - anticipoNum).toFixed(2)),
      );
    } else {
      sale.montoRecibido = '';
      sale.cambio = '';
      if (!sale.banco) {
        throw new BadRequestException('Indica el banco');
      }
      if (forma === 'TRANSFERENCIA' && !sale.cuenta) {
        throw new BadRequestException('Indica la cuenta de transferencia');
      }
      if (forma === 'CHEQUE') {
        sale.cuenta = '';
      }
    }

    this.recomputeSaldo(sale);
    const n = Number(String(sale.precioPlan).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n)) sale.amount = n.toFixed(2);

    // El asesor es el vendedor de la venta (usuario en sesión).
    const seller = await this.usersRepository.findById(user.userId);
    sale.nombreAsesor =
      sale.sellerName?.trim() || seller?.fullName?.trim() || '';

    if (dto.ticketPdf?.dataBase64) {
      const docs = (sale.documents ?? []).filter(
        (d) => d.kind !== DocumentKind.TICKET_PAGO,
      );
      const ticket = new SaleDocument();
      ticket.kind = DocumentKind.TICKET_PAGO;
      ticket.name = dto.ticketPdf.name || `ticket-pago_${sale.id}.pdf`;
      ticket.mime = dto.ticketPdf.mime || 'application/pdf';
      ticket.dataBase64 = dto.ticketPdf.dataBase64;
      ticket.driveFileId = null;
      ticket.driveFileUrl = null;
      docs.push(ticket);
      sale.documents = docs;
    }

    sale.status = SaleStatus.PENDING_SIGNATURE;
    await this.salesRepository.save(sale);

    const full = (await this.salesRepository.findById(id))!;
    const titular =
      full.titularName || (full.holder ? fullName(full.holder) : '') || 'sin titular';

    await this.auditService.record({
      actor: {
        userId: user.userId,
        fullName: seller?.fullName,
        type: user.type,
      },
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.SALE,
      entityId: sale.id,
      summary: `${seller?.fullName ?? 'Vendedor'} registró pago de venta #${sale.id} (${titular})`,
      details: { after: saleToAuditSnapshot(full) },
    });

    return saleToPublic(full);
  }

  async signSale(id: number, user: AuthUserPayload, dto: SignSaleDto) {
    const sale = await this.salesRepository.findById(id);
    if (!sale) throw new NotFoundException('Venta no encontrada');
    this.assertSellerOwns(sale, user.userId);
    if (sale.status !== SaleStatus.PENDING_SIGNATURE) {
      throw new BadRequestException(
        'Solo se puede firmar cuando el pago ya fue registrado',
      );
    }
    if (!dto.firmaCliente?.dataBase64) {
      throw new BadRequestException('La firma es obligatoria');
    }

    const docs = (sale.documents ?? []).filter((d) => d.kind !== DocumentKind.FIRMA);
    const firma = new SaleDocument();
    firma.kind = DocumentKind.FIRMA;
    firma.name = dto.firmaCliente.name || 'firma-cliente.png';
    firma.mime = dto.firmaCliente.mime || 'image/png';
    firma.dataBase64 = dto.firmaCliente.dataBase64;
    firma.driveFileId = null;
    firma.driveFileUrl = null;
    docs.push(firma);

    if (dto.caratulaPdf?.dataBase64) {
      const prevCaratula = docs.find((d) => d.kind === DocumentKind.CARATULA);
      const caratula = prevCaratula ?? new SaleDocument();
      caratula.kind = DocumentKind.CARATULA;
      caratula.name = dto.caratulaPdf.name || `${sale.id}-Caratula.pdf`;
      caratula.mime = dto.caratulaPdf.mime || 'application/pdf';
      caratula.dataBase64 = dto.caratulaPdf.dataBase64;
      caratula.driveFileId = null;
      caratula.driveFileUrl = null;
      if (!prevCaratula) docs.push(caratula);
    }

    const docAtt = (kind: DocumentKind) => {
      const d = docs.find((x) => x.kind === kind);
      if (!d?.dataBase64) return null;
      return { name: d.name, mime: d.mime, dataBase64: d.dataBase64 };
    };
    const documentosPayload: Record<string, unknown> = {
      ine: docAtt(DocumentKind.INE),
      comprobanteDomicilio: docAtt(DocumentKind.COMPROBANTE),
      ticketPago: docAtt(DocumentKind.TICKET_PAGO),
      firmaCliente: dto.firmaCliente,
    };

    const driveKeyToKind: Record<string, DocumentKind> = {
      ine: DocumentKind.INE,
      comprobanteDomicilio: DocumentKind.COMPROBANTE,
      ticketPago: DocumentKind.TICKET_PAGO,
      firmaCliente: DocumentKind.FIRMA,
      caratulaPdf: DocumentKind.CARATULA,
    };

    if (this.googleDrive.isEnabled()) {
      try {
        const driveInfo = await this.googleDrive.uploadSaleDocuments({
          saleId: sale.id,
          titularName: sale.titularName,
          fecha: sale.fecha,
          documentos: documentosPayload,
          caratulaPdf: dto.caratulaPdf ?? null,
        });
        if (!driveInfo) {
          throw new Error('Drive no devolvió carpeta de venta');
        }

        for (const file of driveInfo.files) {
          const kind = driveKeyToKind[file.key];
          if (!kind) continue;
          let doc = docs.find((d) => d.kind === kind);
          if (!doc) {
            doc = new SaleDocument();
            doc.kind = kind;
            doc.name = file.name;
            doc.mime =
              kind === DocumentKind.CARATULA
                ? 'application/pdf'
                : 'application/octet-stream';
            docs.push(doc);
          }
          doc.driveFileId = file.id;
          doc.driveFileUrl = file.url;
          // Firma y ticket se conservan en BD (pesos bajos) para vista previa PDF.
          // INE / comprobante / carátula sí se limpian tras subir a Drive.
          if (
            kind !== DocumentKind.FIRMA &&
            kind !== DocumentKind.TICKET_PAGO
          ) {
            doc.dataBase64 = null;
          }
        }

        sale.documents = docs;
        sale.driveFolderId = driveInfo.folderId;
        sale.driveFolderUrl = driveInfo.folderUrl;
        sale.driveFolderPath = driveInfo.folderName;
        sale.status = SaleStatus.COMPLETED;
        await this.salesRepository.save(sale);
      } catch (e) {
        this.logger.error(
          `Drive venta #${sale.id}: ${(e as Error).message}`,
        );
        throw new BadRequestException(
          `No se pudo subir a Drive: ${(e as Error).message}. Intenta firmar de nuevo.`,
        );
      }
    } else {
      // Sin Drive: se conserva base64 (entorno local / no configurado)
      sale.documents = docs;
      sale.status = SaleStatus.COMPLETED;
      await this.salesRepository.save(sale);
    }

    const full = (await this.salesRepository.findById(id))!;
    const seller = await this.usersRepository.findById(user.userId);
    const titular =
      full.titularName || (full.holder ? fullName(full.holder) : '') || 'sin titular';

    await this.auditService.record({
      actor: {
        userId: user.userId,
        fullName: seller?.fullName,
        type: user.type,
      },
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.SALE,
      entityId: sale.id,
      summary: `${seller?.fullName ?? 'Vendedor'} firmó venta #${sale.id} (${titular})`,
      details: { after: saleToAuditSnapshot(full) },
    });

    return saleToPublic(full);
  }

  async deleteDraft(id: number, user: AuthUserPayload) {
    const sale = await this.salesRepository.findById(id);
    if (!sale) throw new NotFoundException('Venta no encontrada');
    this.assertSellerOwns(sale, user.userId);
    if (sale.status !== SaleStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden eliminar borradores');
    }

    const seller = await this.usersRepository.findById(user.userId);
    const titular =
      sale.titularName || (sale.holder ? fullName(sale.holder) : '') || 'sin titular';
    const snapshot = saleToAuditSnapshot(sale);

    await this.salesRepository.deleteById(id);

    await this.auditService.record({
      actor: {
        userId: user.userId,
        fullName: seller?.fullName,
        type: user.type,
      },
      action: AuditAction.DELETE,
      entityType: AuditEntityType.SALE,
      entityId: id,
      summary: `${seller?.fullName ?? 'Vendedor'} eliminó borrador de venta #${id} (${titular})`,
      details: { after: snapshot },
    });

    return { ok: true };
  }

  /** Compat: alias antiguo submit → finalizeCapture */
  async submit(id: number | null, user: AuthUserPayload, dto: UpsertSaleDto) {
    return this.finalizeCapture(id, user, dto);
  }
}
