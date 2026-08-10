import { Type } from 'class-transformer';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  draftLimit!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  draftTtlHours!: number;

  /** Porcentaje máximo de descuento global (0–100). */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  maxDiscountAmount!: number;
}
