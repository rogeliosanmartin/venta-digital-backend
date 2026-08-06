import {
  BadRequestException,
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
  fullName,
  saleToAuditSnapshot,
  saleToPayload,
  saleToPublic,
} from './mappers/sale.mapper';
import { assertValidCurp } from './utils/curp';
import { SaleDocument } from './entities/sale-document.entity';

const MAX_DRAFTS = 3;
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly salesRepository: SalesRepository,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
    private readonly googleDrive: GoogleDriveService,
  ) {}

  private draftExpiry(from = new Date()) {
    return new Date(from.getTime() + DRAFT_TTL_MS);
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

    return {
      scope: 'own' as const,
      items: visible.map(saleToPublic),
      drafts: drafts.map(saleToPublic),
      submitted: pipeline.map(saleToPublic),
      draftCount: drafts.length,
      draftLimit: MAX_DRAFTS,
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

    return saleToPublic(sale);
  }

  async createDraft(user: AuthUserPayload, dto: UpsertSaleDto) {
    await this.purgeExpired();
    const now = new Date();
    const count = await this.salesRepository.countActiveDrafts(user.userId, now);
    if (count >= MAX_DRAFTS) {
      throw new BadRequestException(
        `Solo puedes tener ${MAX_DRAFTS} borradores. Elimina o envía uno antes de crear otro.`,
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
    sale.draftExpiresAt = this.draftExpiry(now);
    applyPayloadToSale(sale, dto.payload);
    if (dto.titularName?.trim()) sale.titularName = dto.titularName.trim();

    const saved = await this.salesRepository.save(sale);
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
    if (dto.titularName?.trim()) sale.titularName = dto.titularName.trim();
    sale.draftExpiresAt = this.draftExpiry();
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
      const count = await this.salesRepository.countActiveDrafts(
        user.userId,
        new Date(),
      );
      if (count >= MAX_DRAFTS) {
        throw new BadRequestException(
          `Solo puedes tener ${MAX_DRAFTS} borradores activos`,
        );
      }
      sale = this.salesRepository.create();
      sale.sellerId = user.userId;
      sale.sellerName = seller?.fullName ?? 'Vendedor';
      sale.amount = '0';
    }

    applyPayloadToSale(sale, dto.payload);
    sale.status = SaleStatus.PENDING_PAYMENT;
    sale.draftExpiresAt = null;
    sale.titularName =
      dto.titularName?.trim() ||
      (sale.holder ? fullName(sale.holder) : sale.titularName);

    const saved = await this.salesRepository.save(sale);
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
    sale.precioPlan = (p.precioPlan ?? '').trim();
    sale.frecuencia = (p.frecuencia ?? '').trim();
    sale.promocionDescuento = (p.promocionDescuento ?? '').trim();
    sale.anticipo = (p.anticipo ?? '').trim();
    sale.pagoInicial = (p.pagoInicial ?? '').trim();
    sale.plazo = (p.plazo ?? '').trim();
    sale.importeCadaPago = (p.importeCadaPago ?? '').trim();
    sale.saldo = (p.saldo ?? '').trim();
    sale.fechaProximoPago = p.fechaProximoPago?.trim()
      ? p.fechaProximoPago.trim().slice(0, 10)
      : null;
    sale.diasEspecificosPago = (p.diasEspecificosPago ?? '').trim();
    sale.formaPago = (p.formaPago ?? '').trim();
    sale.cuenta = (p.cuenta ?? '').trim();
    sale.banco = (p.banco ?? '').trim();
    sale.nombreJefeVentas = (p.nombreJefeVentas ?? '').trim();
    const n = Number(String(sale.precioPlan).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n)) sale.amount = n.toFixed(2);

    if (!sale.precioPlan) {
      throw new BadRequestException('Indica el precio del plan');
    }

    // El asesor es el vendedor de la venta (usuario en sesión).
    const seller = await this.usersRepository.findById(user.userId);
    sale.nombreAsesor =
      sale.sellerName?.trim() || seller?.fullName?.trim() || '';

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
    docs.push(firma);
    sale.documents = docs;
    sale.status = SaleStatus.COMPLETED;

    await this.salesRepository.save(sale);

    // Drive (INE, comprobante, firma + vista previa carátula)
    try {
      const payload = saleToPayload(sale);
      const driveInfo = await this.googleDrive.uploadSaleDocuments({
        saleId: sale.id,
        titularName: sale.titularName,
        documentos: (payload.documentos ?? {}) as Record<string, unknown>,
        caratulaPdf: dto.caratulaPdf ?? null,
      });
      if (driveInfo) {
        sale.driveFolderId = driveInfo.folderId;
        sale.driveFolderUrl = driveInfo.folderUrl;
        await this.salesRepository.save(sale);
      }
    } catch (e) {
      this.logger.error(
        `Drive venta #${sale.id}: ${(e as Error).message}`,
      );
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
