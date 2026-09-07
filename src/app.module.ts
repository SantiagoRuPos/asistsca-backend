import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration, { AppConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './config/database/database.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    DatabaseModule,
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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}