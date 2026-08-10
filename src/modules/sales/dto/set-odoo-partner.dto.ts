import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class SetOdooPartnerDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  odooPartnerId!: number;
}
