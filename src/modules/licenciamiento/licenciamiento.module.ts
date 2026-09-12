import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { LicenciaEstado } from '../../config/entities/licenciamiento/licencia-estado.entity';
import { LicenciaTokenService } from './licencia-token.service';
import { LicenciaRenovacionService } from './licencia-renovacion.service';
import { LicenciaGuard } from './guards/licencia.guard';
import { LicenciaController } from './licencia.controller';

/**
 * Módulo AISLADO de licenciamiento comercial (Fase 1). No importa ni depende
 * de ningún módulo de negocio (asistencia, NFC, WhatsApp, Telegram, etc.) —
 * solo expone LicenciaGuard, que app.module.ts registra como APP_GUARD.
 *
 * Usa su propia instancia de JwtModule (sin secret ni configuración global)
 * porque LicenciaTokenService verifica con una LLAVE PÚBLICA ECDSA vía
 * `publicKey` por llamada, no con el secreto compartido HS256 que usa
 * JwtAuthGuard para los tokens de sesión de usuarios — son dos sistemas de
 * firma completamente independientes y no deben compartir configuración.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LicenciaEstado]), JwtModule.register({})],
  controllers: [LicenciaController],
  providers: [LicenciaTokenService, LicenciaRenovacionService, LicenciaGuard],
  exports: [LicenciaTokenService, LicenciaGuard],
})
export class LicenciamientoModule {}
