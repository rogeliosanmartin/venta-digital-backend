import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class SetOdooSaleOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  odooSaleOrderId!: number;
}
