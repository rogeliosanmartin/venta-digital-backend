import { Type } from 'class-transformer';
import { IsInt, IsNumber, Max, Min } from 'class-validator';

export class CreateDiscountGrantDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sellerId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  percent!: number;
}
