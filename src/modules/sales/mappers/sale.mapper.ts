import { Sale } from '../entities/sale.entity';
import { SaleHolder } from '../entities/sale-holder.entity';
import { SaleSecondContact } from '../entities/sale-second-contact.entity';
import { SaleBeneficiary } from '../entities/sale-beneficiary.entity';
import { SaleDocument } from '../entities/sale-document.entity';
import { DocumentKind } from '../enums/document-kind.enum';
import { PlanKind } from '../enums/plan-kind.enum';
import { SaleFormPayloadDto } from '../dto/sale-form.dto';

function s(v: unknown, fallback = ''): string {
  return v == null ? fallback : String(v).trim();
}

function dateOrNull(v: unknown): string | null {
  const t = s(v);
  if (!t) return null;
  return t.slice(0, 10);
}

export function fullName(p: {
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombres?: string;
}): string {
  return [p.apellidoPaterno, p.apellidoMaterno, p.nombres]
    .map((x) => s(x))
    .filter(Boolean)
    .join(' ');
}

/** API pública: entidad tipada + payload ensamblado para el front/PDF. */
export function saleToPublic(sale: Sale) {
  return {
    id: sale.id,
    sellerId: sale.sellerId,
    sellerName: sale.sellerName,
    status: sale.status,
    amount: Number(sale.amount) || 0,
    titularName: sale.titularName,
    draftExpiresAt: sale.draftExpiresAt?.toISOString() ?? null,
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
    driveFolderUrl: sale.driveFolderUrl,
    payload: saleToPayload(sale),
  };
}

export function saleToPayload(sale: Sale): Record<string, unknown> {
  const h = sale.holder;
  const sc = sale.secondContact;
  const bens = [...(sale.beneficiaries ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const docs = sale.documents ?? [];
  const findDoc = (kind: DocumentKind) => {
    const d = docs.find((x) => x.kind === kind);
    return d
      ? { name: d.name, mime: d.mime, dataBase64: d.dataBase64 }
      : null;
  };

  return {
    meta: {
      fecha: sale.fecha ?? '',
      contrato: sale.contrato,
      origenVenta: sale.origenVenta,
      folioSolicitud: sale.folioSolicitud,
      fechaServicio: sale.fechaServicio ?? '',
      estatus: sale.estatus,
      anterior: sale.anterior,
      verificacion: sale.verificacion,
    },
    contacto: h
      ? {
          apellidoPaterno: h.apellidoPaterno,
          apellidoMaterno: h.apellidoMaterno,
          nombres: h.nombres,
          sexo: h.sexo,
          curp: h.curp,
          factura: h.factura,
          direccion: h.direccion,
          colonia: h.colonia,
          cp: h.cp,
          entreCalles: h.entreCalles,
          senaParticular: h.senaParticular,
          municipio: h.municipio,
          estado: h.estado,
          tipoCobranza: h.tipoCobranza,
          fechaNacimiento: h.fechaNacimiento ?? '',
          sindicalizado: h.sindicalizado,
          observaciones: h.observaciones,
          celular1: h.celular1,
          celular2: h.celular2,
          correo: h.correo,
          estadoCivil: h.estadoCivil,
          domicilioEntregaDocumentacion: h.domicilioEntregaDocumentacion,
        }
      : {},
    segundoContacto: sc
      ? {
          apellidoPaterno: sc.apellidoPaterno,
          apellidoMaterno: sc.apellidoMaterno,
          nombres: sc.nombres,
          celular: sc.celular,
          parentesco: sc.parentesco,
          direccion: sc.direccion,
          colonia: sc.colonia,
          cp: sc.cp,
          entreCalles: sc.entreCalles,
          fechaNacimiento: sc.fechaNacimiento ?? '',
          domicilioEntregaDocumentacion: sc.domicilioEntregaDocumentacion,
        }
      : {},
    beneficiarios: bens.map((b) => ({
      apellidoPaterno: b.apellidoPaterno,
      apellidoMaterno: b.apellidoMaterno,
      nombres: b.nombres,
      parentesco: b.parentesco,
      celular: b.celular,
      fechaNacimiento: b.fechaNacimiento ?? '',
    })),
    // compat PDF / front antiguo
    derechohabientes: {
      titularSustituto: bens[0]
        ? {
            apellidoPaterno: bens[0].apellidoPaterno,
            apellidoMaterno: bens[0].apellidoMaterno,
            nombres: bens[0].nombres,
            parentesco: bens[0].parentesco,
            celular: bens[0].celular,
            fechaNacimiento: bens[0].fechaNacimiento ?? '',
          }
        : emptyBen(),
      primerBeneficiario: bens[0]
        ? {
            apellidoPaterno: bens[0].apellidoPaterno,
            apellidoMaterno: bens[0].apellidoMaterno,
            nombres: bens[0].nombres,
            parentesco: bens[0].parentesco,
            celular: bens[0].celular,
            fechaNacimiento: bens[0].fechaNacimiento ?? '',
          }
        : emptyBen(),
      segundoBeneficiario: bens[1]
        ? {
            apellidoPaterno: bens[1].apellidoPaterno,
            apellidoMaterno: bens[1].apellidoMaterno,
            nombres: bens[1].nombres,
            parentesco: bens[1].parentesco,
            celular: bens[1].celular,
            fechaNacimiento: bens[1].fechaNacimiento ?? '',
          }
        : emptyBen(),
    },
    ubicacionPlan: {
      planKind: sale.planKind,
      nombrePlan: sale.nombrePlan,
      seccion: sale.seccion,
      cuadrante: sale.cuadrante,
      numero: sale.numero,
      servicioFunerario: sale.servicioFunerario,
      parqueFuneral: sale.parqueFuneral,
      preasignacion: sale.preasignacion,
    },
    pago: {
      precioPlan: sale.precioPlan,
      frecuencia: sale.frecuencia,
      promocionDescuento: sale.promocionDescuento,
      anticipo: sale.anticipo,
      pagoInicial: sale.pagoInicial,
      plazo: sale.plazo,
      importeCadaPago: sale.importeCadaPago,
      saldo: sale.saldo,
      fechaProximoPago: sale.fechaProximoPago ?? '',
      diasEspecificosPago: sale.diasEspecificosPago,
      formaPago: sale.formaPago,
      cuenta: sale.cuenta,
      banco: sale.banco,
      nombreJefeVentas: sale.nombreJefeVentas,
      nombreAsesor: sale.nombreAsesor,
    },
    declaraciones: {
      aceptaMercadotecnia: sale.aceptaMercadotecnia,
      aceptaPublicidad: sale.aceptaPublicidad,
    },
    documentos: {
      ine: findDoc(DocumentKind.INE),
      comprobanteDomicilio: findDoc(DocumentKind.COMPROBANTE),
      firmaCliente: findDoc(DocumentKind.FIRMA),
    },
  };
}

function emptyBen() {
  return {
    apellidoPaterno: '',
    apellidoMaterno: '',
    nombres: '',
    parentesco: '',
    celular: '',
    fechaNacimiento: '',
  };
}

/**
 * Snapshot plano para bitácora (sin base64 ni datos sensibles de archivos).
 */
export function saleToAuditSnapshot(sale: Sale): Record<string, unknown> {
  const h = sale.holder;
  const sc = sale.secondContact;
  const bens = [...(sale.beneficiaries ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const docs = sale.documents ?? [];
  const docLabels: string[] = [];
  if (docs.some((d) => d.kind === DocumentKind.INE)) docLabels.push('INE');
  if (docs.some((d) => d.kind === DocumentKind.COMPROBANTE)) {
    docLabels.push('Comprobante de domicilio');
  }
  if (docs.some((d) => d.kind === DocumentKind.FIRMA)) {
    docLabels.push('Firma');
  }

  const snap: Record<string, unknown> = {
    sellerName: sale.sellerName,
    titularName: sale.titularName || (h ? fullName(h) : ''),
    status: sale.status,
    amount: Number(sale.amount) || 0,
    fecha: sale.fecha ?? '',
    contrato: sale.contrato,
    origenVenta: sale.origenVenta,
    folioSolicitud: sale.folioSolicitud,
    curp: h?.curp ?? '',
    celular: h?.celular1 ?? '',
    correo: h?.correo ?? '',
    municipio: h?.municipio ?? '',
    estado: h?.estado ?? '',
    planKind: sale.planKind,
    nombrePlan: sale.nombrePlan,
    servicioFunerario: sale.servicioFunerario,
    beneficiario1: bens[0] ? fullName(bens[0]) : '',
    beneficiario1Parentesco: bens[0]?.parentesco ?? '',
    beneficiario2: bens[1] ? fullName(bens[1]) : '',
    segundoContacto: sc ? fullName(sc) : '',
    documentos: docLabels.join(', '),
  };

  if (sale.planKind === PlanKind.PARQUE) {
    snap.parqueFuneral = sale.parqueFuneral;
    snap.seccion = sale.seccion;
    snap.cuadrante = sale.cuadrante;
    snap.numero = sale.numero;
    snap.preasignacion = sale.preasignacion;
  }

  if (sale.precioPlan || sale.formaPago || sale.anticipo) {
    snap.precioPlan = sale.precioPlan;
    snap.anticipo = sale.anticipo;
    snap.pagoInicial = sale.pagoInicial;
    snap.frecuencia = sale.frecuencia;
    snap.plazo = sale.plazo;
    snap.importeCadaPago = sale.importeCadaPago;
    snap.saldo = sale.saldo;
    snap.formaPago = sale.formaPago;
    snap.banco = sale.banco;
    snap.cuenta = sale.cuenta;
    snap.nombreAsesor = sale.nombreAsesor;
    snap.nombreJefeVentas = sale.nombreJefeVentas;
  }

  if (sale.driveFolderUrl) {
    snap.driveFolderUrl = sale.driveFolderUrl;
  }

  // Quitar vacíos para no saturar la bitácora
  for (const key of Object.keys(snap)) {
    const v = snap[key];
    if (v === '' || v === null || v === undefined) delete snap[key];
  }
  return snap;
}

export function applyPayloadToSale(sale: Sale, payload: SaleFormPayloadDto) {
  const meta = payload.meta ?? {};
  const plan = payload.ubicacionPlan ?? {};
  const decl = payload.declaraciones ?? {};
  const pago = payload.pago ?? {};

  sale.fecha = dateOrNull(meta.fecha);
  sale.contrato = s(meta.contrato);
  sale.origenVenta = s(meta.origenVenta);
  sale.folioSolicitud = s(meta.folioSolicitud);
  sale.fechaServicio = dateOrNull(meta.fechaServicio);
  sale.estatus = s(meta.estatus, 'ACTIVO');
  sale.anterior = s(meta.anterior);
  sale.verificacion = s(meta.verificacion);

  const kind = s(plan.planKind).toUpperCase();
  sale.planKind =
    kind === PlanKind.PARQUE ? PlanKind.PARQUE : PlanKind.PLAN_FUTURO;
  sale.nombrePlan = s(plan.nombrePlan);
  sale.servicioFunerario = s(plan.servicioFunerario);
  if (sale.planKind === PlanKind.PARQUE) {
    sale.seccion = s(plan.seccion);
    sale.cuadrante = s(plan.cuadrante);
    sale.numero = s(plan.numero);
    sale.parqueFuneral = s(plan.parqueFuneral);
    sale.preasignacion = s(plan.preasignacion, 'N/A');
  } else {
    sale.seccion = '';
    sale.cuadrante = '';
    sale.numero = '';
    sale.parqueFuneral = '';
    sale.preasignacion = 'N/A';
  }

  // Pago solo se aplica si viene (paso aparte); no borrar si el payload de captura lo omite
  if (payload.pago) {
    sale.precioPlan = s(pago.precioPlan);
    sale.frecuencia = s(pago.frecuencia);
    sale.promocionDescuento = s(pago.promocionDescuento);
    sale.anticipo = s(pago.anticipo);
    sale.pagoInicial = s(pago.pagoInicial);
    sale.plazo = s(pago.plazo);
    sale.importeCadaPago = s(pago.importeCadaPago);
    sale.saldo = s(pago.saldo);
    sale.fechaProximoPago = dateOrNull(pago.fechaProximoPago);
    sale.diasEspecificosPago = s(pago.diasEspecificosPago);
    sale.formaPago = s(pago.formaPago);
    sale.cuenta = s(pago.cuenta);
    sale.banco = s(pago.banco);
    sale.nombreAsesor = s(pago.nombreAsesor);
    sale.nombreJefeVentas = s(pago.nombreJefeVentas);
  }

  sale.aceptaMercadotecnia = s(decl.aceptaMercadotecnia);
  sale.aceptaPublicidad = s(decl.aceptaPublicidad);

  const c = payload.contacto ?? {};
  if (!sale.holder) sale.holder = new SaleHolder();
  const h = sale.holder;
  h.apellidoPaterno = s(c.apellidoPaterno);
  h.apellidoMaterno = s(c.apellidoMaterno);
  h.nombres = s(c.nombres);
  h.sexo = s(c.sexo);
  h.curp = s(c.curp).toUpperCase();
  h.factura = s(c.factura);
  h.fechaNacimiento = dateOrNull(c.fechaNacimiento);
  h.estadoCivil = s(c.estadoCivil);
  h.sindicalizado = s(c.sindicalizado);
  h.observaciones = s(c.observaciones);
  h.celular1 = s(c.celular1);
  h.celular2 = s(c.celular2);
  h.correo = s(c.correo);
  h.direccion = s(c.direccion);
  h.colonia = s(c.colonia);
  h.cp = s(c.cp);
  h.entreCalles = s(c.entreCalles);
  h.senaParticular = s(c.senaParticular);
  h.municipio = s(c.municipio);
  h.estado = s(c.estado);
  h.tipoCobranza = s(c.tipoCobranza);
  h.domicilioEntregaDocumentacion = s(c.domicilioEntregaDocumentacion);

  const sc = payload.segundoContacto ?? {};
  if (!sale.secondContact) sale.secondContact = new SaleSecondContact();
  const s2 = sale.secondContact;
  s2.apellidoPaterno = s(sc.apellidoPaterno);
  s2.apellidoMaterno = s(sc.apellidoMaterno);
  s2.nombres = s(sc.nombres);
  s2.celular = s(sc.celular);
  s2.parentesco = s(sc.parentesco);
  s2.direccion = s(sc.direccion);
  s2.colonia = s(sc.colonia);
  s2.cp = s(sc.cp);
  s2.entreCalles = s(sc.entreCalles);
  s2.fechaNacimiento = dateOrNull(sc.fechaNacimiento);
  s2.domicilioEntregaDocumentacion = s(sc.domicilioEntregaDocumentacion);

  let list = payload.beneficiarios;
  if (!list?.length && (payload as { derechohabientes?: unknown }).derechohabientes) {
    const d = (payload as {
      derechohabientes: {
        primerBeneficiario?: SaleFormPayloadDto['beneficiarios'] extends (infer U)[] | undefined ? U : never;
        segundoBeneficiario?: SaleFormPayloadDto['beneficiarios'] extends (infer U)[] | undefined ? U : never;
      };
    }).derechohabientes;
    list = [d.primerBeneficiario, d.segundoBeneficiario].filter(
      (x) => x && (s(x.nombres) || s(x.apellidoPaterno)),
    ) as SaleFormPayloadDto['beneficiarios'];
  }

  const beneficiaries: SaleBeneficiary[] = [];
  (list ?? []).slice(0, 2).forEach((b, i) => {
    const row = new SaleBeneficiary();
    row.sortOrder = i;
    row.apellidoPaterno = s(b.apellidoPaterno);
    row.apellidoMaterno = s(b.apellidoMaterno);
    row.nombres = s(b.nombres);
    row.parentesco = s(b.parentesco);
    row.celular = s(b.celular);
    row.fechaNacimiento = dateOrNull(b.fechaNacimiento);
    beneficiaries.push(row);
  });
  sale.beneficiaries = beneficiaries;

  const docs: SaleDocument[] = [];
  const pushDoc = (
    kind: DocumentKind,
    att: { name?: string; mime?: string; dataBase64?: string } | null | undefined,
  ) => {
    if (!att?.dataBase64) return;
    const d = new SaleDocument();
    d.kind = kind;
    d.name = s(att.name, kind.toLowerCase());
    d.mime = s(att.mime, 'application/octet-stream');
    d.dataBase64 = att.dataBase64;
    docs.push(d);
  };
  // conservar firma si el payload de captura no la manda
  const existingFirma = sale.documents?.find((d) => d.kind === DocumentKind.FIRMA);
  pushDoc(DocumentKind.INE, payload.documentos?.ine);
  pushDoc(DocumentKind.COMPROBANTE, payload.documentos?.comprobanteDomicilio);
  if (payload.documentos?.firmaCliente) {
    pushDoc(DocumentKind.FIRMA, payload.documentos.firmaCliente);
  } else if (existingFirma) {
    docs.push(existingFirma);
  }
  sale.documents = docs;

  sale.titularName = fullName(h) || sale.titularName;
  if (sale.precioPlan) {
    const n = Number(String(sale.precioPlan).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n)) sale.amount = n.toFixed(2);
  }
}
