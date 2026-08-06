import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import {
  SavePaymentDto,
  SignSaleDto,
  UpsertSaleDto,
} from './dto/sale-form.dto';

@Controller('sales')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('mias')
  @Roles(UserType.VENDEDOR)
  mySales(@CurrentUser() user: AuthUserPayload) {
    return this.salesService.listOwnSales(user.userId);
  }

  @Get('referencias')
  @Roles(UserType.VENDEDOR)
  references(@CurrentUser() user: AuthUserPayload) {
    return this.salesService.listReferences(user.userId);
  }

  @Get('todas')
  @Roles(UserType.MONITOR, UserType.ADMIN)
  @RequirePermissions(PermissionCode.VENTAS_VER)
  allSales() {
    return this.salesService.listAllSales();
  }

  @Get(':id')
  @Roles(UserType.VENDEDOR, UserType.MONITOR, UserType.ADMIN)
  getOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.salesService.getOne(id, user);
  }

  @Post('drafts')
  @Roles(UserType.VENDEDOR)
  createDraft(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpsertSaleDto,
  ) {
    return this.salesService.createDraft(user, dto);
  }

  @Patch(':id/draft')
  @Roles(UserType.VENDEDOR)
  updateDraft(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpsertSaleDto,
  ) {
    return this.salesService.updateDraft(id, user, dto);
  }

  /** Finaliza captura (sin pago ni firma). */
  @Post('finalize')
  @Roles(UserType.VENDEDOR)
  finalizeNew(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpsertSaleDto,
  ) {
    return this.salesService.finalizeCapture(null, user, dto);
  }

  @Post(':id/finalize')
  @Roles(UserType.VENDEDOR)
  finalizeExisting(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpsertSaleDto,
  ) {
    return this.salesService.finalizeCapture(id, user, dto);
  }

  /** Compat con front anterior. */
  @Post('submit')
  @Roles(UserType.VENDEDOR)
  submitNew(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpsertSaleDto,
  ) {
    return this.salesService.finalizeCapture(null, user, dto);
  }

  @Post(':id/submit')
  @Roles(UserType.VENDEDOR)
  submitExisting(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpsertSaleDto,
  ) {
    return this.salesService.finalizeCapture(id, user, dto);
  }

  @Patch(':id/payment')
  @Roles(UserType.VENDEDOR)
  savePayment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: SavePaymentDto,
  ) {
    return this.salesService.savePayment(id, user, dto);
  }

  @Post(':id/sign')
  @Roles(UserType.VENDEDOR)
  sign(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: SignSaleDto,
  ) {
    return this.salesService.signSale(id, user, dto);
  }

  @Delete(':id')
  @Roles(UserType.VENDEDOR)
  deleteDraft(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.salesService.deleteDraft(id, user);
  }
}
