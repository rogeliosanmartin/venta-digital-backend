import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export type OdooPlanProduct = {
  id: number;
  name: string;
  listPrice: number;
  defaultCode: string | null;
  companyId: number;
  isPlanProduct: boolean;
  /** product.template.without_interest */
  withoutInterest: boolean;
};

export type OdooUbicacionOption = {
  id: number;
  name: string;
  code?: string | null;
  status?: string | null;
};

export type OdooReserveSpaceResult = {
  spaceId: number;
  status: string;
  previousStatus: string;
  name: string;
  code: string | null;
  note: string;
  alreadyReserved?: boolean;
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
  async getPlanesByIds(companyId: 1 | 2, ids: number[]) {
    if (!this.http) {
      throw new ServiceUnavailableException(
        'Integración Odoo no configurada (API_ODOO_GSM_URL)',
      );
    }
    const uniqueIds = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
    if (!uniqueIds.length) return [];
    try {
      const { data } = await this.http.get<OdooPlanProduct[]>(
        '/productos/planes',
        { params: { companyId, ids: uniqueIds.join(',') } },
      );
      const rows = Array.isArray(data) ? data : [];
      const byId = new Map(rows.map((row) => [row.id, row]));
      return uniqueIds.map((id) => byId.get(id)).filter(Boolean) as OdooPlanProduct[];
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Error al consultar planes en Odoo';
      this.logger.error(`getPlanesByIds: ${msg}`);
      throw new ServiceUnavailableException(
        typeof msg === 'string' ? msg : 'Error al consultar planes en Odoo',
      );
    }
  }

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

  private async getUbicaciones<T>(
    path: string,
    params: Record<string, string | number | undefined>,
  ) {
    if (!this.http) {
      throw new ServiceUnavailableException(
        'Integración Odoo no configurada (API_ODOO_GSM_URL)',
      );
    }
    try {
      const { data } = await this.http.get<T>(path, { params });
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Error al consultar ubicaciones en Odoo';
      this.logger.error(`${path}: ${msg}`);
      throw new ServiceUnavailableException(
        typeof msg === 'string' ? msg : 'Error al consultar ubicaciones en Odoo',
      );
    }
  }

  async listServiceTypes() {
    if (!this.http) {
      throw new ServiceUnavailableException(
        'Integración Odoo no configurada (API_ODOO_GSM_URL)',
      );
    }
    try {
      const { data } = await this.http.get<Array<{ id: number; name: string }>>(
        '/productos/tipos-servicio',
      );
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Error al consultar tipos de servicio en Odoo';
      this.logger.error(`listServiceTypes: ${msg}`);
      throw new ServiceUnavailableException(
        typeof msg === 'string' ? msg : 'Error al consultar tipos de servicio en Odoo',
      );
    }
  }

  async listBranches() {
    if (!this.http) {
      throw new ServiceUnavailableException(
        'Integración Odoo no configurada (API_ODOO_GSM_URL)',
      );
    }
    try {
      const { data } = await this.http.get<Array<{ id: number; name: string }>>(
        '/productos/sucursales',
      );
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Error al consultar sucursales en Odoo';
      this.logger.error(`listBranches: ${msg}`);
      throw new ServiceUnavailableException(
        typeof msg === 'string' ? msg : 'Error al consultar sucursales en Odoo',
      );
    }
  }

  searchParques(q?: string, limit = 20) {
    return this.getUbicaciones<OdooUbicacionOption>('/ubicaciones/parques', {
      q: q?.trim() || undefined,
      limit,
    });
  }

  searchSecciones(parkId: number, q?: string, limit = 20) {
    return this.getUbicaciones<OdooUbicacionOption>('/ubicaciones/secciones', {
      parkId,
      q: q?.trim() || undefined,
      limit,
    });
  }

  searchCuadrantes(
    parkId: number,
    sectionId: number,
    q?: string,
    limit = 20,
  ) {
    return this.getUbicaciones<OdooUbicacionOption>(
      '/ubicaciones/cuadrantes',
      {
        parkId,
        sectionId,
        q: q?.trim() || undefined,
        limit,
      },
    );
  }

  searchEspacios(
    parkId: number,
    sectionId: number,
    quadrantId: number,
    q?: string,
    limit = 20,
  ) {
    return this.getUbicaciones<OdooUbicacionOption>('/ubicaciones/espacios', {
      parkId,
      sectionId,
      quadrantId,
      q: q?.trim() || undefined,
      limit,
    });
  }

  async syncVdReception(payload: Record<string, unknown>) {
    if (!this.http) {
      throw new ServiceUnavailableException(
        'Integración Odoo no configurada (API_ODOO_GSM_URL)',
      );
    }
    try {
      const { data } = await this.http.post<{
        receptionId: number;
        created: boolean;
      }>('/expedientes/venta-digital', payload, { timeout: 120000 });
      return data;
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        (Array.isArray(e?.response?.data?.message)
          ? e.response.data.message.join(', ')
          : null) ||
        e?.message ||
        'No se pudo guardar el expediente en Odoo';
      this.logger.error(`syncVdReception: ${msg}`);
      throw new ServiceUnavailableException(
        typeof msg === 'string' ? msg : 'No se pudo guardar el expediente en Odoo',
      );
    }
  }

  async reserveSpace(input: {
    spaceId: number;
    folio: string;
    sellerName: string;
  }) {
    if (!this.http) {
      throw new ServiceUnavailableException(
        'Integración Odoo no configurada (API_ODOO_GSM_URL)',
      );
    }
    try {
      const { data } = await this.http.post<OdooReserveSpaceResult>(
        '/ubicaciones/espacios/reservar',
        input,
      );
      return data;
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message ||
        (Array.isArray(e?.response?.data?.message)
          ? e.response.data.message.join(', ')
          : null) ||
        e?.message ||
        'No se pudo apartar la ubicación en Odoo';
      this.logger.error(`reserveSpace: ${msg}`);
      if (status === 409 || status === 400 || status === 404) {
        throw new BadRequestException(
          typeof msg === 'string' ? msg : 'No se pudo apartar la ubicación',
        );
      }
      throw new ServiceUnavailableException(
        typeof msg === 'string' ? msg : 'No se pudo apartar la ubicación en Odoo',
      );
    }
  }
}
