import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class SellerDefaultPlanDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}

export class UpdateSellerDefaultsDto {
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultBranchId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  defaultBranchName?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => SellerDefaultPlanDto)
  defaultFuturePlans?: SellerDefaultPlanDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => SellerDefaultPlanDto)
  defaultParkPlans?: SellerDefaultPlanDto[];
}
