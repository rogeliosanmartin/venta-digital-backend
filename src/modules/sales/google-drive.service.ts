import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';

type DriveAttachment = {
  name?: string;
  mime?: string;
  dataBase64?: string;
};

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
];

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private drive: drive_v3.Drive | null = null;
  private folderId: string | null = null;
  private oauth2: OAuth2Client | null = null;
  private authMode: 'oauth' | 'service_account' | 'none' = 'none';

  constructor(private readonly config: ConfigService) {
    this.init();
  }

  private init() {
    const folderId = this.config.get<string>('GOOGLE_DRIVE_FOLDER_ID')?.trim();
    if (!folderId) {
      this.logger.warn('GOOGLE_DRIVE_FOLDER_ID no configurado; no se subirá a Drive');
      return;
    }
    this.folderId = folderId;

    if (this.initOAuth()) return;
    this.initServiceAccount();
  }

  private initOAuth(): boolean {
    const clientId = this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')?.trim();
    const clientSecret = this.config
      .get<string>('GOOGLE_OAUTH_CLIENT_SECRET')
      ?.trim();
    const redirectUri =
      this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI')?.trim() ||
      'http://localhost:3022/api/drive/oauth/callback';
    const refreshToken = this.config
      .get<string>('GOOGLE_OAUTH_REFRESH_TOKEN')
      ?.trim();

    if (!clientId || !clientSecret) return false;

    this.oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    if (refreshToken) {
      this.oauth2.setCredentials({ refresh_token: refreshToken });
      this.drive = google.drive({ version: 'v3', auth: this.oauth2 });
      this.authMode = 'oauth';
      this.logger.log('Google Drive listo (OAuth usuario Workspace)');
      return true;
    }

    this.logger.warn(
      'Falta GOOGLE_OAUTH_REFRESH_TOKEN en .env. Abre /api/drive/oauth/start con el usuario Workspace.',
    );
    return true;
  }

  private initServiceAccount() {
    const keyJson = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON')?.trim();

    try {
      const credentials = keyJson
        ? (JSON.parse(keyJson) as Record<string, unknown>)
        : null;

      if (!credentials) {
        this.logger.warn('Sin credenciales Drive (OAuth ni Service Account)');
        return;
      }

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      this.drive = google.drive({ version: 'v3', auth });
      this.authMode = 'service_account';
      this.logger.warn(
        'Google Drive con Service Account (puede fallar por cuota en Drive personal)',
      );
    } catch (e) {
      this.logger.error(
        `No se pudo inicializar Google Drive: ${(e as Error).message}`,
      );
    }
  }

  isEnabled() {
    return Boolean(this.drive && this.folderId);
  }

  getAuthMode() {
    return this.authMode;
  }

  needsOAuthConsent() {
    return Boolean(this.oauth2) && this.authMode !== 'oauth';
  }

  getAuthUrl(): string {
    if (!this.oauth2) {
      throw new Error('OAuth no configurado (faltan CLIENT_ID / SECRET)');
    }
    return this.oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: DRIVE_SCOPES,
    });
  }

  async handleOAuthCallback(code: string) {
    if (!this.oauth2) {
      throw new Error('OAuth no configurado');
    }
    const { tokens } = await this.oauth2.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error(
        'Google no devolvió refresh_token. Revoca el acceso de la app en la cuenta y vuelve a autorizar.',
      );
    }
    this.oauth2.setCredentials(tokens);
    this.drive = google.drive({ version: 'v3', auth: this.oauth2 });
    this.authMode = 'oauth';
    this.logger.log(
      'OAuth Drive autorizado en memoria. Copia GOOGLE_OAUTH_REFRESH_TOKEN al .env y reinicia.',
    );
    return {
      ok: true,
      mode: this.authMode,
      folderId: this.folderId,
      refreshToken: tokens.refresh_token,
      hint: 'Pon GOOGLE_OAUTH_REFRESH_TOKEN en el .env y reinicia el backend.',
    };
  }

  private bufferFromAttachment(att: DriveAttachment): Buffer | null {
    const raw = (att.dataBase64 ?? '').trim();
    if (!raw) return null;
    const b64 = raw.includes(',') ? raw.split(',')[1]! : raw;
    try {
      return Buffer.from(b64, 'base64');
    } catch {
      return null;
    }
  }

  private sanitizeDriveName(value: string, max = 80): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max) || 'Sin-nombre';
  }

  private static readonly MONTH_LABELS = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ] as const;

  /** Año/mes en zona de negocio. Mes: `01-enero`. */
  private resolveYearMonth(fecha?: string | null): { year: string; month: string } {
    const tz =
      this.config.get<string>('BUSINESS_TIMEZONE')?.trim() ||
      'America/Mexico_City';
    const fromFecha = fecha?.trim()?.slice(0, 10);
    let date: Date;
    if (fromFecha && /^\d{4}-\d{2}-\d{2}$/.test(fromFecha)) {
      date = new Date(`${fromFecha}T12:00:00`);
    } else {
      date = new Date();
    }
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
    const monthNum = parts.find((p) => p.type === 'month')?.value ?? '01';
    const idx = Math.max(0, Math.min(11, Number(monthNum) - 1));
    const month = `${monthNum}-${GoogleDriveService.MONTH_LABELS[idx]}`;
    return { year, month };
  }

  private async findChildFolder(
    parentId: string,
    name: string,
  ): Promise<string | null> {
    if (!this.drive) return null;
    const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const res = await this.drive.files.list({
      q: [
        `'${parentId}' in parents`,
        `name = '${escaped}'`,
        `mimeType = 'application/vnd.google-apps.folder'`,
        'trashed = false',
      ].join(' and '),
      fields: 'files(id, name)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return res.data.files?.[0]?.id ?? null;
  }

  private async findOrCreateFolder(parentId: string, name: string) {
    if (!this.drive) throw new Error('Drive no configurado');
    const existing = await this.findChildFolder(parentId, name);
    if (existing) {
      return { id: existing, name, webViewLink: null as string | null };
    }
    const res = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });
    return {
      id: res.data.id!,
      name: res.data.name ?? name,
      webViewLink: res.data.webViewLink ?? null,
    };
  }

  /**
   * Ruta: raíz → AÑO → MES → FOLIO-nombrecliente
   */
  private async createSaleFolder(params: {
    folio: number | string;
    titularName: string | null;
    fecha?: string | null;
  }) {
    if (!this.drive || !this.folderId) {
      throw new Error('Drive no configurado');
    }
    const { year, month } = this.resolveYearMonth(params.fecha);
    const client = this.sanitizeDriveName(params.titularName || 'Sin titular');
    const saleFolderName = `${params.folio}-${client}`;

    const yearFolder = await this.findOrCreateFolder(this.folderId, year);
    const monthFolder = await this.findOrCreateFolder(yearFolder.id, month);
    const saleFolder = await this.findOrCreateFolder(
      monthFolder.id,
      saleFolderName,
    );

    // webViewLink solo viene al crear; si reutiliza carpeta, armar URL
    const webViewLink =
      saleFolder.webViewLink ||
      `https://drive.google.com/drive/folders/${saleFolder.id}`;

    return {
      id: saleFolder.id,
      name: `${year}/${month}/${saleFolderName}`,
      webViewLink,
    };
  }

  private async uploadBuffer(
    parentId: string,
    fileName: string,
    mime: string,
    buffer: Buffer,
  ) {
    if (!this.drive) throw new Error('Drive no configurado');
    const res = await this.drive.files.create({
      requestBody: {
        name: fileName,
        parents: [parentId],
      },
      media: {
        mimeType: mime || 'application/octet-stream',
        body: Readable.from(buffer),
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });
    return {
      id: res.data.id!,
      name: res.data.name ?? fileName,
      webViewLink: res.data.webViewLink ?? null,
    };
  }

  /** Reemplaza el contenido de un archivo existente (mismo id / enlace). */
  async updateFileBuffer(
    fileId: string,
    mime: string,
    buffer: Buffer,
  ): Promise<{ id: string; name: string; url: string | null }> {
    if (!this.drive) throw new Error('Drive no configurado');
    const res = await this.drive.files.update({
      fileId,
      media: {
        mimeType: mime || 'application/octet-stream',
        body: Readable.from(buffer),
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });
    return {
      id: res.data.id ?? fileId,
      name: res.data.name ?? '',
      url: res.data.webViewLink ?? null,
    };
  }

  /**
   * Crea carpeta por venta y sube INE, comprobante, firma y carátula PDF.
   * El caller (signSale) falla el flujo si esta subida no es exitosa.
   */
  async uploadSaleDocuments(params: {
    saleId: number;
    titularName: string | null;
    /** Fecha del contrato (YYYY-MM-DD); define carpeta AÑO/MES. */
    fecha?: string | null;
    documentos: Record<string, unknown>;
    /** Vista previa del contrato generada en el front (opcional). */
    caratulaPdf?: DriveAttachment | null;
  }): Promise<{
    folderId: string;
    folderName: string;
    folderUrl: string | null;
    files: { key: string; id: string; name: string; url: string | null }[];
  } | null> {
    if (!this.isEnabled()) return null;

    const { saleId, titularName, fecha, documentos, caratulaPdf } = params;
    const folio = String(saleId);
    const folder = await this.createSaleFolder({
      folio,
      titularName,
      fecha,
    });
    const files: {
      key: string;
      id: string;
      name: string;
      url: string | null;
    }[] = [];

    const entries: { key: string; label: string }[] = [
      { key: 'ine', label: 'INE' },
      { key: 'comprobanteDomicilio', label: 'Comprobante' },
      { key: 'constanciaSituacionFiscal', label: 'ConstanciaFiscal' },
      { key: 'ticketPago', label: 'Ticket' },
      { key: 'firmaCliente', label: 'Firma' },
    ];

    for (const { key, label } of entries) {
      const att = documentos[key] as DriveAttachment | null | undefined;
      if (!att?.dataBase64) continue;
      const buffer = this.bufferFromAttachment(att);
      if (!buffer) continue;
      const ext = att.mime?.includes('pdf')
        ? 'pdf'
        : att.mime?.includes('jpeg') || att.mime?.includes('jpg')
          ? 'jpg'
          : att.mime?.includes('png')
            ? 'png'
            : att.name?.split('.').pop() || 'bin';
      const uploaded = await this.uploadBuffer(
        folder.id,
        `${folio}-${label}.${ext}`,
        att.mime || 'application/octet-stream',
        buffer,
      );
      files.push({
        key,
        id: uploaded.id,
        name: uploaded.name,
        url: uploaded.webViewLink,
      });
    }

    if (caratulaPdf?.dataBase64) {
      const buffer = this.bufferFromAttachment(caratulaPdf);
      if (buffer) {
        const uploaded = await this.uploadBuffer(
          folder.id,
          `${folio}-Caratula.pdf`,
          caratulaPdf.mime || 'application/pdf',
          buffer,
        );
        files.push({
          key: 'caratulaPdf',
          id: uploaded.id,
          name: uploaded.name,
          url: uploaded.webViewLink,
        });
      }
    }

    this.logger.log(
      `Drive: venta #${saleId} → ${folder.name} (${files.length} archivos) [${this.authMode}]`,
    );

    return {
      folderId: folder.id,
      folderName: folder.name,
      folderUrl:
        folder.webViewLink ||
        `https://drive.google.com/drive/folders/${folder.id}`,
      files,
    };
  }

  /** Prueba de subida (md/pdf) a la carpeta raíz configurada. */
  async uploadTestFile(fileName: string, mime: string, buffer: Buffer) {
    if (!this.isEnabled() || !this.folderId) {
      throw new Error('Drive no habilitado o sin token OAuth');
    }
    return this.uploadBuffer(this.folderId, fileName, mime, buffer);
  }

  /** Busca la carátula ya subida en la carpeta de la venta (ventas firmadas antes del fix). */
  async findCaratulaInFolder(
    folderId: string,
    saleId: number,
  ): Promise<{ id: string; name: string; url: string | null } | null> {
    if (!this.drive || !folderId?.trim()) return null;
    const folio = String(saleId);
    try {
      const res = await this.drive.files.list({
        q: [
          `'${folderId}' in parents`,
          `name contains '${folio}-Caratula'`,
          'trashed = false',
        ].join(' and '),
        fields: 'files(id, name, webViewLink)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const file = res.data.files?.[0];
      if (!file?.id) return null;
      return {
        id: file.id,
        name: file.name ?? `${folio}-Caratula.pdf`,
        url: file.webViewLink ?? null,
      };
    } catch (e) {
      this.logger.warn(
        `Drive: no se pudo buscar carátula venta #${saleId}: ${(e as Error).message}`,
      );
      return null;
    }
  }

  /** Descarga un archivo de Drive como base64 (p. ej. firma para vista previa). */
  async downloadFileBase64(
    fileId: string,
  ): Promise<{ mime: string; dataBase64: string } | null> {
    if (!this.drive || !fileId?.trim()) return null;
    try {
      const meta = await this.drive.files.get({
        fileId,
        fields: 'id, mimeType',
        supportsAllDrives: true,
      });
      const res = await this.drive.files.get(
        {
          fileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        { responseType: 'arraybuffer' },
      );
      const buffer = Buffer.from(res.data as ArrayBuffer);
      return {
        mime: meta.data.mimeType || 'application/octet-stream',
        dataBase64: buffer.toString('base64'),
      };
    } catch (e) {
      this.logger.warn(
        `Drive download ${fileId}: ${(e as Error).message}`,
      );
      return null;
    }
  }
}
