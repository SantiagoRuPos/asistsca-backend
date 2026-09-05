import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramBotController } from './telegram_bot.controller';
import { TelegramBotService } from './telegram_bot.service';
import { Usuario } from '../config/entities/usuarios/usuario.entity';
import { AcademicoModule } from '../modules/academico/academico.module';
import { AsistenciaModule } from '../modules/asistencia/asistencia.module';

@Module({
  imports: [
    // Repositorio propio de Usuario: el bot necesita buscar por telegramChatId
    // y por telefono para el flujo de verificación (whitelist), algo que no
    // le pertenece a UsuariosService (esa es la gestión de cuentas desde la
    // interfaz web, no la identidad de Telegram).
    TypeOrmModule.forFeature([Usuario]),
    // Se reutilizan los servicios ya existentes (no se duplica la lógica de
    // conteo de estudiantes/asistencia) — ambos módulos exportan su service
    // específicamente para este caso de uso.
    AcademicoModule,
    AsistenciaModule,
  ],
  controllers: [TelegramBotController],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
