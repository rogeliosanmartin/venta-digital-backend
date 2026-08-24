import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SaleAttachmentDto {
  @IsString()
  name!: string;

  @IsString()
  mime!: string;

  @IsString()
  dataBase64!: string;
}

export class SalePersonDto {
  @IsOptional() @IsString() apellidoPaterno?: string;
  @IsOptional() @IsString() apellidoMaterno?: string;
  @IsOptional() @IsString() nombres?: string;
}

export class SaleContactoDto extends SalePersonDto {
  @IsOptional() @IsString() sexo?: string;
  @IsOptional() @IsString() curp?: string;
  @IsOptional() @IsString() factura?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() colonia?: string;
  @IsOptional() @IsString() cp?: string;
  @IsOptional() @IsString() entreCalles?: string;
  @IsOptional() @IsString() senaParticular?: string;
  @IsOptional() @IsString() municipio?: string;
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsString() tipoCobranza?: string;
  @IsOptional() @IsString() fechaNacimiento?: string;
  @IsOptional() @IsString() sindicalizado?: string;
  @IsOptional() @IsString() observaciones?: string;
  @IsOptional() @IsString() celular1?: string;
  @IsOptional() @IsString() celular2?: string;
  @IsOptional() @IsString() correo?: string;
  @IsOptional() @IsString() estadoCivil?: string;
  @IsOptional() @IsString() domicilioEntregaDocumentacion?: string;
}

export class SaleSegundoDto extends SalePersonDto {
  @IsOptional() @IsString() celular?: string;
  @IsOptional() @IsString() parentesco?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() colonia?: string;
  @IsOptional() @IsString() cp?: string;
  @IsOptional() @IsString() entreCalles?: string;
  @IsOptional() @IsString() fechaNacimiento?: string;
  @IsOptional() @IsString() domicilioEntregaDocumentacion?: string;
}

export class SaleBeneficiaryDto extends SalePersonDto {
  @IsOptional() @IsString() parentesco?: string;
  @IsOptional() @IsString() celular?: string;
  @IsOptional() @IsString() fechaNacimiento?: string;
}

export class SaleDerechohabientesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => SaleBeneficiaryDto)
  titularSustituto?: SaleBeneficiaryDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SaleBeneficiaryDto)
  primerBeneficiario?: SaleBeneficiaryDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SaleBeneficiaryDto)
  segundoBeneficiario?: SaleBeneficiaryDto;
}

export class SaleMetaDto {
  @IsOptional() @IsString() fecha?: string;
  @IsOptional() @IsString() contrato?: string;
  @IsOptional() @IsString() origenVenta?: string;
  @IsOptional() @Type(() => Number) @IsInt() branchId?: number | null;
  @IsOptional() @IsString() branchName?: string;
  @IsOptional() @Type(() => Number) @IsInt() serviceTypeId?: number | null;
  @IsOptional() @IsString() serviceTypeName?: string;
  @IsOptional() @IsString() folioSolicitud?: string;
  @IsOptional() @IsString() fechaServicio?: string;
  @IsOptional() @IsString() estatus?: string;
  @IsOptional() @IsString() anterior?: string;
  @IsOptional() @IsString() verificacion?: string;
}

export class SalePlanDto {
  @IsOptional()
  @IsIn(['PARQUE', 'PLAN_FUTURO', ''])
  planKind?: string;

  @IsOptional() @IsString() nombrePlan?: string;
  @IsOptional() @Type(() => Number) @IsInt() productId?: number | null;
  @IsOptional() @IsString() productDefaultCode?: string;
  @IsOptional() @IsString() precioPlan?: string;
  @IsOptional() @IsString() seccion?: string;
  @IsOptional() @IsString() cuadrante?: string;
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() servicioFunerario?: string;
  @IsOptional() @IsString() parqueFuneral?: string;
  @IsOptional() @Type(() => Number) @IsInt() parkId?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() sectionId?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() quadrantId?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() spaceId?: number | null;
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value == null || value === '') return false;
    const t = String(value).trim().toLowerCase();
    return ['true', '1', 'si', 'sí', 'yes'].includes(t);
  })
  @IsBoolean()
  preasignacion?: boolean;

  /** product.template.without_interest — plan sin intereses (solo UI/cálculo financiero). */
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value == null || value === '') return false;
    const t = String(value).trim().toLowerCase();
    return ['true', '1', 'si', 'sí', 'yes'].includes(t);
  })
  @IsBoolean()
  withoutInterest?: boolean;
}

export class SalePagoDto {
  @IsOptional() @IsString() precioPlan?: string;
  @IsOptional() @IsString() frecuencia?: string;
  @IsOptional() @IsString() promocionDescuento?: string;
  @IsOptional() @IsString() anticipo?: string;
  @IsOptional() @IsString() pagoInicial?: string;
  @IsOptional() @IsString() plazo?: string;
  @IsOptional() @IsString() importeCadaPago?: string;
  @IsOptional() @IsString() saldo?: string;
  @IsOptional() @IsString() fechaProximoPago?: string;
  @IsOptional() @IsString() diasEspecificosPago?: string;
  @IsOptional() @IsString() formaPago?: string;
  @IsOptional() @IsString() cuenta?: string;
  @IsOptional() @IsString() banco?: string;
  @IsOptional() @IsString() montoRecibido?: string;
  @IsOptional() @IsString() cambio?: string;
  @IsOptional() @IsString() nombreJefeVentas?: string;
  @IsOptional() @IsString() nombreAsesor?: string;
}

export class SaleFormPayloadDto {
  @IsOptional() @ValidateNested() @Type(() => SaleMetaDto) meta?: SaleMetaDto;
  @IsOptional() @ValidateNested() @Type(() => SaleContactoDto) contacto?: SaleContactoDto;
  @IsOptional() @ValidateNested() @Type(() => SaleSegundoDto) segundoContacto?: SaleSegundoDto;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleBeneficiaryDto)
  beneficiarios?: SaleBeneficiaryDto[];
  @IsOptional()
  @ValidateNested()
  @Type(() => SaleDerechohabientesDto)
  derechohabientes?: SaleDerechohabientesDto;
  @IsOptional() @ValidateNested() @Type(() => SalePlanDto) ubicacionPlan?: SalePlanDto;
  @IsOptional() @ValidateNested() @Type(() => SalePagoDto) pago?: SalePagoDto;
  @IsOptional()
  @IsObject()
  declaraciones?: { aceptaMercadotecnia?: string; aceptaPublicidad?: string };
  @IsOptional()
  @IsObject()
  documentos?: {
    ine?: SaleAttachmentDto | null;
    comprobanteDomicilio?: SaleAttachmentDto | null;
    firmaCliente?: SaleAttachmentDto | null;
    ticketPago?: SaleAttachmentDto | null;
  };
}

export class UpsertSaleDto {
  @ValidateNested()
  @Type(() => SaleFormPayloadDto)
  payload!: SaleFormPayloadDto;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  titularName?: string;

  @IsOptional()
  @IsString()
  amount?: string;
}

export class SavePaymentDto {
  @ValidateNested()
  @Type(() => SalePagoDto)
  pago!: SalePagoDto;

  /** Ticket de pago PDF generado en el front. */
  @IsOptional()
  @ValidateNested()
  @Type(() => SaleAttachmentDto)
  ticketPdf?: SaleAttachmentDto | null;
}

export class SignSaleDto {
  @ValidateNested()
  @Type(() => SaleAttachmentDto)
  firmaCliente!: SaleAttachmentDto;

  /** Vista previa / carátula del contrato (PDF generado en el front). */
  @IsOptional()
  @ValidateNested()
  @Type(() => SaleAttachmentDto)
  caratulaPdf?: SaleAttachmentDto | null;
}
