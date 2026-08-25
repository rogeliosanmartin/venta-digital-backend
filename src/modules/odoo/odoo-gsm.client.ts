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

export type OdooClienteContacto = {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  sexo: string;
  curp: string;
  factura: string;
  direccion: string;
  colonia: string;
  cp: string;
  entreCalles: string;
  senaParticular: string;
  municipio: string;
  estado: string;
  tipoCobranza: string;
  fechaNacimiento: string;
  sindicalizado: string;
  observaciones: string;
  celular1: string;
  celular2: string;
  correo: string;
  estadoCivil: string;
  domicilioEntregaDocumentacion: string;
};

export type OdooClienteSegundo = {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  celular: string;
  parentesco: string;
  direccion: string;
  colonia: string;
  cp: string;
  entreCalles: string;
  fechaNacimiento: string;
  domicilioEntregaDocumentacion: string;
};

export type OdooClienteBeneficiary = {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  parentesco: string;
  celular: string;
  fechaNacimiento: string;
};

export type OdooCliente = {
  id: number;
  name: string;
  contacto: OdooClienteContacto;
  segundoContacto: OdooClienteSegundo | null;
  titularSustituto: OdooClienteBeneficiary;
  beneficiarios: OdooClienteBeneficiary[];
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

  async searchClientes(q: string, limit = 20) {
    if (!this.http) {
      throw new ServiceUnavailableException(
        'Búsqueda de clientes no configurada',
      );
    }
    try {
      const { data } = await this.http.get<OdooCliente[]>('/clientes', {
        params: { q, limit },
      });
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'No se pudo buscar el cliente';
      this.logger.error(`searchClientes: ${msg}`);
      if (status === 400) {
        throw new BadRequestException(
          typeof msg === 'string' ? msg : 'Indica el nombre del cliente',
        );
      }
      throw new ServiceUnavailableException(
        typeof msg === 'string' ? msg : 'No se pudo buscar el cliente',
      );
    }
  }

  async getCliente(id: number) {
    if (!this.http) {
      throw new ServiceUnavailableException(
        'Búsqueda de clientes no configurada',
      );
    }
    try {
      const { data } = await this.http.get<OdooCliente>(`/clientes/${id}`);
      return data;
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'No se pudo leer el cliente';
      this.logger.error(`getCliente: ${msg}`);
      if (status === 404 || status === 400) {
        throw new BadRequestException(
          typeof msg === 'string' ? msg : 'Cliente no encontrado',
        );
      }
      throw new ServiceUnavailableException(
        typeof msg === 'string' ? msg : 'No se pudo leer el cliente',
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
