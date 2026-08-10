import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OdooGsmClient } from './odoo-gsm.client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserType } from '../../common/enums/user-type.enum';

@Controller('odoo')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OdooController {
  constructor(private readonly odoo: OdooGsmClient) {}

  /**
   * Proxy a api-odoo-gsm productos/planes.
   * planKind: PARQUE → companyId 1 · PLAN_FUTURO → companyId 2
   */
  @Get('planes')
  @Roles(UserType.VENDEDOR, UserType.MONITOR, UserType.ADMIN)
  searchPlanes(
    @Query('planKind') planKind: string,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    const kind = (planKind || '').trim().toUpperCase();
    const companyId: 1 | 2 = kind === 'PARQUE' ? 1 : kind === 'PLAN_FUTURO' ? 2 : 0 as any;
    if (companyId !== 1 && companyId !== 2) {
      throw new BadRequestException(
        'planKind debe ser PARQUE o PLAN_FUTURO',
      );
    }
    if (!(q || '').trim()) {
      throw new BadRequestException('Indica el texto a buscar (q)');
    }
    return this.odoo.searchPlanes(
      companyId,
      q.trim(),
      limit ? Number(limit) : 20,
    );
  }
}
