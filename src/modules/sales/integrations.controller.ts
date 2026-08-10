import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { SetOdooPartnerDto } from './dto/set-odoo-partner.dto';
import { SalesService } from './sales.service';

/**
 * Integraciones externas (Odoo Mesa de Control).
 * Auth: header `X-Api-Key` = ODOO_API_KEY del .env
 */
@Controller('integrations/odoo')
@UseGuards(ApiKeyGuard)
export class IntegrationsController {
  constructor(private readonly salesService: SalesService) {}

  /** Listado liviano para Conciliación. */
  @Get('sales')
  conciliationSales() {
    return this.salesService.listForConciliation();
  }

  /** Detalle completo (captura + adjuntos) al abrir una venta en Odoo. */
  @Get('sales/:id')
  conciliationSaleDetail(@Param('id', ParseIntPipe) id: number) {
    return this.salesService.getOneForOdoo(id);
  }

  /** Guarda el id de res.partner asociado desde Odoo. */
  @Patch('sales/:id/partner')
  setPartner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetOdooPartnerDto,
  ) {
    return this.salesService.setOdooPartner(id, dto.odooPartnerId);
  }
}
