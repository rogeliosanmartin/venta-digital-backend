import { Logger as NestLogger } from '@nestjs/common';
import type { Logger, QueryRunner } from 'typeorm';

const MAX_PARAM = 120;

function compactParams(parameters?: unknown[]): string {
  if (!parameters?.length) return '';
  const safe = parameters.map((p) => {
    if (typeof p === 'string' && p.length > MAX_PARAM) {
      return `${p.slice(0, 16)}…[${p.length} chars]`;
    }
    if (Buffer.isBuffer(p) && p.length > MAX_PARAM) {
      return `<Buffer ${p.length} bytes>`;
    }
    return p;
  });
  try {
    return JSON.stringify(safe);
  } catch {
    return '[params]';
  }
}

/** Evita tirar base64/INE/PDF enteros a consola cuando DB_LOGGING=true. */
export class TruncatingTypeOrmLogger implements Logger {
  private readonly logger = new NestLogger('TypeORM');

  logQuery(query: string, parameters?: unknown[], _qr?: QueryRunner) {
    this.logger.log(`${query} -- ${compactParams(parameters)}`);
  }

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: unknown[],
    _qr?: QueryRunner,
  ) {
    const msg = error instanceof Error ? error.message : error;
    this.logger.error(`${msg} | ${query} -- ${compactParams(parameters)}`);
  }

  logQuerySlow(
    time: number,
    query: string,
    parameters?: unknown[],
    _qr?: QueryRunner,
  ) {
    this.logger.warn(`Slow ${time}ms | ${query} -- ${compactParams(parameters)}`);
  }

  logSchemaBuild(message: string, _qr?: QueryRunner) {
    this.logger.log(message);
  }

  logMigration(message: string, _qr?: QueryRunner) {
    this.logger.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown, _qr?: QueryRunner) {
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    if (level === 'warn') this.logger.warn(text);
    else this.logger.log(text);
  }
}
