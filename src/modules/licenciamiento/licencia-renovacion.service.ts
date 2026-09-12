import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppConfig } from '../../config/configuration';
import { LicenciaTokenService } from './licencia-token.service';
import { calcularFingerprintServidor } from './utils/fingerprint.util';

/**
 * Job de renovación periódica. FASE 2 (todavía no existe): apunta a una URL
 * de un servidor de licencias propio de SCA que hoy no está construido — la
 * llamada HTTP de abajo fallará (ECONNREFUSED / DNS / 404) hasta que ese
 * servidor exista, y eso es esperado: el catch solo registra el intento
 * fallido, nunca tumba la aplicación ni cuenta como "validación exitosa".
 *
 * Mientras tanto, el estado de la licencia se sigue calculando en cada
 * request a partir del archivo local (ver LicenciaTokenService) — este job
 * es un mecanismo adicional para refrescar ESE archivo automáticamente
 * cuando el servidor de licencias sí exista, no el único punto de
 * verificación (la firma/expiración/fingerprint se revisan en cada
 * revalidación, no solo aquí).
 */
@Injectable()
export class LicenciaRenovacionService {
  private readonly logger = new Logger(LicenciaRenovacionService.name);

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly licenciaTokenService: LicenciaTokenService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async intentarRenovar(): Promise<void> {
    const url = this.configService.get('licencia.servidorUrl', { infer: true });
    const fingerprint = calcularFingerprintServidor();

    try {
      const respuesta = await axios.post<{ token: string }>(
        url,
        { fingerprint },
        { timeout: 10_000 },
      );

      const tokenNuevo = respuesta.data?.token;
      if (!tokenNuevo) {
        this.logger.warn('El servidor de licencias respondió sin un token. No se actualizó nada.');
        return;
      }

      const rutaToken = resolve(
        process.cwd(),
        this.configService.get('licencia.tokenPath', { infer: true }),
      );
      writeFileSync(rutaToken, tokenNuevo, 'utf8');

      const estado = await this.licenciaTokenService.revalidar();
      this.logger.log(`Token de licencia renovado automáticamente. Estado: ${estado.nivel}.`);
    } catch (error) {
      // Esperado mientras el servidor de licencias (Fase 2) no exista.
      this.logger.warn(
        `No se pudo renovar la licencia contra ${url}: ${(error as Error).message}. ` +
          'Esto es normal si el servidor de licencias de Fase 2 todavía no está desplegado.',
      );
    }
  }
}
