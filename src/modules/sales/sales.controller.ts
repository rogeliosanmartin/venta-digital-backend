import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SalesService } from './sales.service';
import {
  CurrentUser,
  AuthUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { UserType } from '../../common/enums/user-type.enum';
import { PermissionCode } from '../../common/constants/permissions.constants';

@Controller('sales')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  /** Listado de ventas propias del vendedor autenticado. */
  @Get('mias')
  @Roles(UserType.VENDEDOR)
  mySales(@CurrentUser() user: AuthUserPayload) {
    return this.salesService.listOwnSales(user.userId);
  }

  /**
   * Todas las ventas de los vendedores.
   * Monitor y Admin con permiso ventas.ver.
   */
  @Get('todas')
  @Roles(UserType.MONITOR, UserType.ADMIN)
  @RequirePermissions(PermissionCode.VENTAS_VER)
  allSales() {
    return this.salesService.listAllSales();
  }
}
