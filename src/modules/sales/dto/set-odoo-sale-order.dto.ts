import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SetOdooSaleOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  odooSaleOrderId!: number;

  /** Nombre de la cotización Odoo (`sale.order.name`). */
  @IsOptional()
  @IsString()
  contrato?: string;
}
