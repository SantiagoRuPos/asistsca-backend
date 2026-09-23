import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { LicenciaEstado } from '../../config/entities/licenciamiento/licencia-estado.entity';
import { LicenciaTokenService } from './licencia-token.service';
import { LicenciaRenovacionService } from './licencia-renovacion.service';
import { LicenciaGuard } from './guards/licencia.guard';
import { LicenciaController } from './licencia.controller';
import { TelegramApiModule } from '../../telegram_bot/telegram-api.module';

/**
 * Módulo de licenciamiento comercial (Fase 1). No importa ni depende de
 * ningún módulo de NEGOCIO (asistencia, NFC, WhatsApp, bot de Telegram
 * conversacional, etc.) — solo expone LicenciaGuard, que app.module.ts
 * registra como APP_GUARD.
 *
 * Única excepción, deliberada: importa `TelegramApiModule` (el envoltorio
 * delgado y sin dependencias sobre la API de Telegram, no el bot completo)
 * para poder avisarle a SCA por Telegram cuando una instalación pasa a
 * "aviso"/"degradada". Es el mismo patrón ya usado por AuthModule para la
 * alerta de inicio de sesión — TelegramApiModule está pensado justamente
 * para que cualquier módulo lo importe sin crear una dependencia real de
 * negocio ni un ciclo.
 *
 * Usa su propia instancia de JwtModule (sin secret ni configuración global)
 * porque LicenciaTokenService verifica con una LLAVE PÚBLICA ECDSA vía
 * `publicKey` por llamada, no con el secreto compartido HS256 que usa
 * JwtAuthGuard para los tokens de sesión de usuarios — son dos sistemas de
 * firma completamente independientes y no deben compartir configuración.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LicenciaEstado]), JwtModule.register({}), TelegramApiModule],
  controllers: [LicenciaController],
  providers: [LicenciaTokenService, LicenciaRenovacionService, LicenciaGuard],
  exports: [LicenciaTokenService, LicenciaGuard],
})
export class LicenciamientoModule {}
