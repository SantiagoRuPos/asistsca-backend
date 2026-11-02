import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import configuration, { AppConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './config/database/database.module';
import { AdminSeederModule } from './config/database/admin-seeder.module';
import { ColegioModule } from './modules/colegio/colegio.module';
import { CatalogosModule } from './modules/catalogos/catalogos.module';
import { AcademicoModule } from './modules/academico/academico.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AuthModule } from './modules/auth/auth.module';
import { NfcModule } from './modules/nfc/nfc.module';
import { AsistenciaModule } from './modules/asistencia/asistencia.module';
import { ComunicacionesModule } from './modules/comunicaciones/comunicaciones.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { TelegramBotModule } from './telegram_bot/telegram_bot.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { LicenciamientoModule } from './modules/licenciamiento/licenciamiento.module';
import { LicenciaGuard } from './modules/licenciamiento/guards/licencia.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    DatabaseModule,
    AdminSeederModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        throttlers: [
          {
            ttl: configService.get('throttle.ttlMs', { infer: true }),
            limit: configService.get('throttle.limit', { infer: true }),
          },
        ],
      }),
    }),
    ColegioModule,
    CatalogosModule,
    AcademicoModule,
    UsuariosModule,
    AuthModule,
    NfcModule,
    AsistenciaModule,
    ComunicacionesModule,
    WhatsappModule,
    AuditoriaModule,
    TelegramBotModule,
    ReportesModule,
    LicenciamientoModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Guard global de licenciamiento comercial (Fase 1) — corre en TODAS las
    // rutas, después de ThrottlerGuard. No reemplaza ni modifica los guards
    // de auth/roles existentes en cada controlador; se suma a ellos.
    {
      provide: APP_GUARD,
      useClass: LicenciaGuard,
    },
  ],
})
export class AppModule {}