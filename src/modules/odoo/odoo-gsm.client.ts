import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export type OdooPlanProduct = {
  id: number;
  name: string;
  listPrice: number;
  defaultCode: string | null;
  companyId: number;
  isPlanProduct: boolean;
};

@Injectable()
export class OdooGsmClient {
  private readonly logger = new Logger(OdooGsmClient.name);
  private readonly http: AxiosInstance | null;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (config.get<string>('API_ODOO_GSM_URL') || '').replace(
      /\/$/,
      '',
    );
    if (!this.baseUrl) {
      this.http = null;
      this.logger.warn(
        'API_ODOO_GSM_URL no configurado; búsqueda de planes deshabilitada',
      );
      return;
    }
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 20000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  isConfigured() {
    return Boolean(this.http);
  }

  /**
   * companyId Odoo: 1 Parque · 2 Plan a futuro
   */
  async searchPlanes(companyId: 1 | 2, q: string, limit = 20) {
    if (!this.http) {
      throw new ServiceUnavailableException(
        'Integración Odoo no configurada (API_ODOO_GSM_URL)',
      );
    }
    try {
      const { data } = await this.http.get<OdooPlanProduct[]>(
        '/productos/planes',
        { params: { companyId, q, limit } },
      );
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Error al consultar planes en Odoo';
      this.logger.error(`searchPlanes: ${msg}`);
      throw new ServiceUnavailableException(
        typeof msg === 'string' ? msg : 'Error al consultar planes en Odoo',
      );
    }
  }
}
