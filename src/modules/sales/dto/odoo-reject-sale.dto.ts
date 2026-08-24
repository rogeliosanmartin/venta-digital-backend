import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class OdooRejectSaleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
