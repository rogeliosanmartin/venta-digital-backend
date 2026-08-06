import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuditEntityType } from '../enums/audit-entity-type.enum';
import { AuditAction } from '../enums/audit-action.enum';

export class ListAuditLogsQueryDto {
  /** Palabra clave: busca en resumen, actor, acción, tipo y detalle JSON. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  /** Fecha inicio (YYYY-MM-DD) en zona America/Mexico_City */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateFrom debe ser YYYY-MM-DD',
  })
  dateFrom?: string;

  /** Fecha fin (YYYY-MM-DD) en zona America/Mexico_City */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateTo debe ser YYYY-MM-DD',
  })
  dateTo?: string;

  @IsOptional()
  @IsEnum(AuditEntityType)
  entityType?: AuditEntityType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  entityId?: number;

  /** Filtrar por usuario que realizó la acción. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  actorUserId?: number;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
