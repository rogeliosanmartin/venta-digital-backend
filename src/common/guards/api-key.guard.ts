import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Autenticación máquina-a-máquina (p. ej. Odoo Mesa de Control).
 * Header: `X-Api-Key: <ODOO_API_KEY>`
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = normalizeKey(this.config.get<string>('ODOO_API_KEY'));
    if (!expected) {
      throw new UnauthorizedException(
        'ODOO_API_KEY no está configurada en el servidor',
      );
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = normalizeKey(
      (req.headers['x-api-key'] as string | undefined) ||
        extractBearerApiKey(req.headers.authorization),
    );

    if (!header) {
      throw new UnauthorizedException('Falta header X-Api-Key');
    }
    if (header !== expected) {
      throw new UnauthorizedException('API key inválida');
    }
    return true;
  }
}

function normalizeKey(raw?: string | null): string {
  return String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

function extractBearerApiKey(authorization?: string): string {
  if (!authorization) return '';
  const m = /^ApiKey\s+(.+)$/i.exec(authorization.trim());
  return m?.[1]?.trim() || '';
}
