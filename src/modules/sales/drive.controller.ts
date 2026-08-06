import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { GoogleDriveService } from './google-drive.service';

/**
 * OAuth Drive (sin JWT): el navegador debe completar el consentimiento
 * con un usuario de Google Workspace que tenga acceso a la carpeta.
 */
@Controller('drive')
export class DriveController {
  constructor(private readonly googleDrive: GoogleDriveService) {}

  @Get('oauth/status')
  status() {
    return {
      enabled: this.googleDrive.isEnabled(),
      mode: this.googleDrive.getAuthMode(),
      needsConsent: this.googleDrive.needsOAuthConsent(),
      authorizeUrl: '/api/drive/oauth/start',
    };
  }

  @Get('oauth/start')
  start(@Res() res: Response) {
    try {
      const url = this.googleDrive.getAuthUrl();
      return res.redirect(url);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Get('oauth/callback')
  async callback(@Query('code') code: string, @Query('error') error: string) {
    if (error) {
      throw new BadRequestException(`Google OAuth error: ${error}`);
    }
    if (!code?.trim()) {
      throw new BadRequestException('Falta code en el callback de Google');
    }
    const result = await this.googleDrive.handleOAuthCallback(code.trim());
    return {
      message:
        'Drive autorizado. Ya puedes subir documentos de ventas con este usuario.',
      ...result,
    };
  }
}
