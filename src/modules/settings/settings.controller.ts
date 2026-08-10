import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserType } from '../../common/enums/user-type.enum';
import {
  AuthUserPayload,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@Controller('settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Política de captura (borradores + tope descuento) para vendedor/monitor/admin. */
  @Get('drafts')
  @Roles(UserType.VENDEDOR, UserType.MONITOR, UserType.ADMIN)
  drafts(@CurrentUser() user: AuthUserPayload) {
    return this.settingsService.getSellerCapturePolicy(user.userId);
  }

  /** Configuración completa — solo ADMIN. */
  @Get()
  @Roles(UserType.ADMIN)
  async get() {
    const s = await this.settingsService.get();
    return this.settingsService.toPublic(s);
  }

  @Patch()
  @Roles(UserType.ADMIN)
  async update(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const s = await this.settingsService.update(dto, user);
    return this.settingsService.toPublic(s);
  }
}
