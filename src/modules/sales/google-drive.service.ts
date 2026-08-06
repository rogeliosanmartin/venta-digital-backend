import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

type DriveAttachment = {
  name?: string;
  mime?: string;
  dataBase64?: string;
};

type StoredOAuthToken = {
  refresh_token?: string;
  access_token?: string;
  expiry_date?: number | null;
  token_type?: string;
  scope?: string;
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
  private tokenPath: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.init();
  }

  private resolvePath(p: string) {
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
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
    const tokenPathRaw =
      this.config.get<string>('GOOGLE_OAUTH_TOKEN_PATH')?.trim() ||
      'secrets/google-oauth-token.json';

    let id = clientId;
    let secret = clientSecret;
    const clientPath = this.config
      .get<string>('GOOGLE_OAUTH_CLIENT_PATH')
      ?.trim();
    if ((!id || !secret) && clientPath) {
      try {
        const resolved = this.resolvePath(clientPath);
        if (fs.existsSync(resolved)) {
          const json = JSON.parse(fs.readFileSync(resolved, 'utf8')) as {
            web?: { client_id?: string; client_secret?: string };
            installed?: { client_id?: string; client_secret?: string };
          };
          id = id || json.web?.client_id || json.installed?.client_id;
          secret =
            secret || json.web?.client_secret || json.installed?.client_secret;
        }
      } catch (e) {
        this.logger.warn(
          `No se pudo leer GOOGLE_OAUTH_CLIENT_PATH: ${(e as Error).message}`,
        );
      }
    }

    if (!id || !secret) return false;

    this.oauth2 = new google.auth.OAuth2(id, secret, redirectUri);
    this.tokenPath = this.resolvePath(tokenPathRaw);

    if (fs.existsSync(this.tokenPath)) {
      try {
        const tokens = JSON.parse(
          fs.readFileSync(this.tokenPath, 'utf8'),
        ) as StoredOAuthToken;
        if (tokens.refresh_token) {
          this.oauth2.setCredentials(tokens);
          this.oauth2.on('tokens', (fresh) => {
            this.persistTokens({
              ...tokens,
              ...fresh,
              refresh_token: fresh.refresh_token || tokens.refresh_token,
            });
          });
          this.drive = google.drive({ version: 'v3', auth: this.oauth2 });
          this.authMode = 'oauth';
          this.logger.log('Google Drive listo (OAuth usuario Workspace)');
          return true;
        }
      } catch (e) {
        this.logger.warn(
          `Token OAuth inválido: ${(e as Error).message}. Reautoriza en /api/drive/oauth/start`,
        );
      }
    }

    // Credenciales OAuth listas; falta consentimiento del usuario.
    this.logger.warn(
      'OAuth Drive configurado pero sin refresh token. Abre /api/drive/oauth/start con el usuario Workspace.',
    );
    return true; // no usar Service Account si ya hay OAuth configurado
  }

  private initServiceAccount() {
    const keyPath = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_PATH')?.trim();
    const keyJson = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON')?.trim();

    try {
      let credentials: Record<string, unknown> | null = null;
      if (keyJson) {
        credentials = JSON.parse(keyJson) as Record<string, unknown>;
      } else if (keyPath) {
        const resolved = this.resolvePath(keyPath);
        if (!fs.existsSync(resolved)) {
          this.logger.warn(`No existe el archivo de credenciales: ${resolved}`);
          return;
        }
        credentials = JSON.parse(
          fs.readFileSync(resolved, 'utf8'),
        ) as Record<string, unknown>;
      }

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

  private persistTokens(tokens: StoredOAuthToken) {
    if (!this.tokenPath) return;
    const dir = path.dirname(this.tokenPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
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
    this.persistTokens(tokens as StoredOAuthToken);
    this.oauth2.on('tokens', (fresh) => {
      const prev = fs.existsSync(this.tokenPath!)
        ? (JSON.parse(
            fs.readFileSync(this.tokenPath!, 'utf8'),
          ) as StoredOAuthToken)
        : {};
      this.persistTokens({
        ...prev,
        ...fresh,
        refresh_token: fresh.refresh_token || prev.refresh_token,
      });
    });
    this.drive = google.drive({ version: 'v3', auth: this.oauth2 });
    this.authMode = 'oauth';
    this.logger.log('OAuth Drive autorizado y token guardado');
    return {
      ok: true,
      mode: this.authMode,
      folderId: this.folderId,
      tokenPath: this.tokenPath,
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

  private async createSaleFolder(saleId: number, titularName: string | null) {
    if (!this.drive || !this.folderId) {
      throw new Error('Drive no configurado');
    }
    const safe = (titularName || 'Sin titular')
      .replace(/[\\/:*?"<>|]/g, '-')
      .trim()
      .slice(0, 80);
    const name = `Venta-${saleId}_${safe}`;
    const res = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [this.folderId],
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

  /**
   * Crea carpeta por venta y sube INE, comprobante, firma y carátula PDF.
   * No falla el envío de venta si Drive falla (se registra en log).
   */
  async uploadSaleDocuments(params: {
    saleId: number;
    titularName: string | null;
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

    const { saleId, titularName, documentos, caratulaPdf } = params;
    const folder = await this.createSaleFolder(saleId, titularName);
    const files: {
      key: string;
      id: string;
      name: string;
      url: string | null;
    }[] = [];

    const entries: { key: string; label: string }[] = [
      { key: 'ine', label: 'INE' },
      { key: 'comprobanteDomicilio', label: 'Comprobante-domicilio' },
      { key: 'firmaCliente', label: 'Firma-cliente' },
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
        `${label}_venta-${saleId}.${ext}`,
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
          `Caratula-contrato_venta-${saleId}.pdf`,
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
      `Drive: venta #${saleId} → carpeta ${folder.name} (${files.length} archivos) [${this.authMode}]`,
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
}
