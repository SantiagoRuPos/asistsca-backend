import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { AppConfig } from '../../config/configuration';

export interface EnvioCorreoResultado {
  enviado: boolean;
  motivo?: string;
}

/**
 * Envoltorio delgado sobre nodemailer.
 *
 * SMTP_USER/SMTP_PASS pueden estar vacios (el usuario los completa manualmente
 * despues de crear el proyecto). Mientras falten, este servicio NO intenta
 * enviar nada y devuelve { enviado: false, motivo: '...' } en vez de lanzar
 * una excepcion: crear un usuario nuevo nunca debe fallar solo porque el
 * correo saliente todavia no esta configurado.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transportador: Transporter | null = null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const smtp = this.configService.get('smtp', { infer: true });

    if (smtp.host && smtp.user && smtp.pass) {
      this.transportador = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
      });
    } else {
      this.logger.warn(
        'SMTP no esta configurado por completo (falta SMTP_USER y/o SMTP_PASS en .env). ' +
          'El envio de correos quedara deshabilitado hasta que se complete.',
      );
    }
  }

  estaConfigurado(): boolean {
    return this.transportador !== null;
  }

  async enviarCorreo(opciones: { para: string; asunto: string; html: string }): Promise<EnvioCorreoResultado> {
    if (!this.transportador) {
      return { enviado: false, motivo: 'El servidor de correo (SMTP) todavia no ha sido configurado.' };
    }

    const brand = this.configService.get('brand', { infer: true });

    try {
      await this.transportador.sendMail({
        from: `"${brand.name}" <${this.configService.get('smtp', { infer: true }).user}>`,
        to: opciones.para,
        subject: opciones.asunto,
        html: opciones.html,
      });
      return { enviado: true };
    } catch (error) {
      this.logger.error(`No se pudo enviar el correo a ${opciones.para}: ${(error as Error).message}`);
      return { enviado: false, motivo: 'No se pudo contactar el servidor SMTP. Revisa las credenciales en .env.' };
    }
  }
}
