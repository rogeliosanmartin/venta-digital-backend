import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { normalizeMxPhone } from '../sales/utils/phone';

export type TicketNotificationInput = {
  customerName: string;
  amount: number;
  phone?: string | null;
  email?: string | null;
  pdfBase64?: string | null;
  pdfName?: string | null;
};

/**
 * Mismo envío que api-recibodigital-nest al generar un ticket:
 * SMS + correo (API_SMS / n8n) y WhatsApp (API_OMNI comercial/tickectReciboDigital).
 */
@Injectable()
export class TicketNotificationService {
  private readonly logger = new Logger(TicketNotificationService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPaymentTicket(input: TicketNotificationInput): Promise<void> {
    const phone = normalizeMxPhone(input.phone);
    const email = (input.email || '').trim();
    const amount = Number.isFinite(input.amount) ? input.amount : 0;
    const formattedAmount = this.formatMexicanPeso(amount);
    const simpleAmount = this.formatSimplePeso(amount);
    const name = (input.customerName || 'Cliente').trim();

    const pdfUrl = await this.uploadTicketPdf(
      input.pdfBase64,
      input.pdfName || 'ticket-pago.pdf',
    );

    if (phone.length === 10) {
      await this.safe('SMS', () =>
        this.sendSms(
          phone,
          `Hemos recibido tu pago de ${formattedAmount} ✅. 
Gracias por confiar en Grupo San Martín, 
estamos para acompañarte y brindarte seguridad en cada paso.`,
        ),
      );
    } else {
      this.logger.warn('Ticket: sin celular válido; no se envió SMS ni WhatsApp');
    }

    if (email) {
      await this.safe('correo', () =>
        this.sendEmail(
          email,
          `Estimado/a ${name}
    
Hemos recibido tu pago de ${formattedAmount} ✅
Adjunto encontrarás tu recibo digital correspondiente.

Gracias por confiar en Grupo San Martín. Estamos para acompañarte y brindarte seguridad en cada paso.

Atentamente,
Grupo San Martín`,
          'Recibo de pago - Grupo San Martín',
          pdfUrl,
        ),
      );
    } else {
      this.logger.warn('Ticket: sin correo; no se envió email');
    }

    if (phone.length === 10 && pdfUrl) {
      await this.safe('WhatsApp', () =>
        this.sendTicketWhatsapp({
          celular: phone,
          importe: simpleAmount,
          url: pdfUrl,
        }),
      );
    } else if (phone.length === 10 && !pdfUrl) {
      this.logger.warn(
        'Ticket: sin URL pública del PDF; no se envió WhatsApp',
      );
    }
  }

  private async sendSms(celular: string, message: string) {
    const url = this.envUrl('API_SMS');
    if (!url) throw new Error('API_SMS no configurado');
    await axios.post(url, {
      type: 'sms',
      params: {
        to: `52${celular}`,
        message,
      },
    });
  }

  private async sendEmail(
    correo: string,
    body: string,
    subject: string,
    pdfLink?: string | null,
  ) {
    const url = this.envUrl('API_SMS');
    if (!url) throw new Error('API_SMS no configurado');
    await axios.post(url, {
      type: 'email',
      params: {
        body,
        to: correo,
        subject,
        pdfLink: pdfLink || undefined,
      },
    });
  }

  /** Endpoint Omni: POST {API_OMNI}comercial/tickectReciboDigital */
  private async sendTicketWhatsapp(request: {
    celular: string;
    importe: string;
    url: string;
  }) {
    const base = this.envUrl('API_OMNI');
    if (!base) throw new Error('API_OMNI no configurado');
    const url = `${base.replace(/\/+$/, '')}/comercial/tickectReciboDigital`;
    await axios.post(url, request);
  }

  private async uploadTicketPdf(
    dataBase64?: string | null,
    fileName = 'ticket-pago.pdf',
  ): Promise<string | null> {
    const raw = (dataBase64 || '').trim();
    if (!raw) return null;
    const storage = this.envUrl('API_STORAGE');
    const s3 = this.envUrl('S3_ROUTE');
    if (!storage || !s3) {
      this.logger.warn('API_STORAGE o S3_ROUTE no configurados; sin PDF público');
      return null;
    }
    const b64 = raw.includes(',') ? raw.split(',')[1]! : raw;
    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length) return null;

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }),
      fileName,
    );
    form.append('userId', 'pdf/TICKET');
    form.append('fileType', 'pdf');
    form.append('name', fileName);

    const { data } = await axios.post(
      `${storage.replace(/\/+$/, '')}/storage/RECIBODIGITAL`,
      form,
      { timeout: 180000 },
    );
    const file = data?.file;
    if (!file) {
      this.logger.warn('Storage no devolvió file para el ticket');
      return null;
    }
    return `${s3.replace(/\/+$/, '')}/${String(file).replace(/^\/+/, '')}`;
  }

  private envUrl(key: string): string {
    return (this.config.get<string>(key) ?? '').trim().replace(/^['"]|['"]$/g, '');
  }

  private formatMexicanPeso(amount: number): string {
    return amount.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  private formatSimplePeso(amount: number): string {
    return `$${amount.toLocaleString('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }

  private async safe(channel: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      this.logger.error(
        `No se pudo enviar el ticket por ${channel}: ${(e as Error).message}`,
      );
    }
  }
}
