import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RequestSellerPinDto } from './dto/request-seller-pin.dto';
import { VerifySellerPinDto } from './dto/verify-seller-pin.dto';
import { MonitorLoginDto } from './dto/monitor-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import {
  CurrentUser,
  AuthUserPayload,
} from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Vendedor — solicita PIN WhatsApp */
  @Post('vendedor/solicitar-pin')
  @HttpCode(HttpStatus.OK)
  requestSellerPin(@Body() dto: RequestSellerPinDto) {
    return this.authService.requestSellerPin(dto.cellphone);
  }

  /** Vendedor — valida PIN y obtiene sesión (token hasta fin del día) */
  @Post('vendedor/verificar-pin')
  @HttpCode(HttpStatus.OK)
  verifySellerPin(@Body() dto: VerifySellerPinDto) {
    return this.authService.verifySellerPin(dto);
  }

  /** Monitor / Admin — login con usuario y contraseña */
  @Post('monitor/login')
  @HttpCode(HttpStatus.OK)
  loginMonitor(@Body() dto: MonitorLoginDto) {
    return this.authService.loginMonitor(dto);
  }

  /** Renueva access token con refresh (solo MONITOR/ADMIN) */
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@CurrentUser() user: AuthUserPayload) {
    return this.authService.me(user.userId);
  }
}
