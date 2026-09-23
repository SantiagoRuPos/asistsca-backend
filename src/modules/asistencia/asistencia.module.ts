import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaConsultaController } from './asistencia-consulta.controller';
import { ExcusasController } from './excusas.controller';
import { AutorizacionesSalidaController } from './autorizaciones-salida.controller';
import { AsistenciaService } from './asistencia.service';
import { ExcusasService } from './excusas.service';
import { AutorizacionesSalidaService } from './autorizaciones-salida.service';
import { EventoAsistencia } from '../../config/entities/nfc/evento-asistencia.entity';
import { TarjetaNfc } from '../../config/entities/nfc/tarjeta-nfc.entity';
import { TarjetaDesconocida } from '../../config/entities/nfc/tarjeta-desconocida.entity';
import { LectorNfc } from '../../config/entities/nfc/lector-nfc.entity';
import { AsistenciaDiaria } from '../../config/entities/asistencia/asistencia-diaria.entity';
import { Excusa } from '../../config/entities/asistencia/excusa.entity';
import { AutorizacionSalida } from '../../config/entities/asistencia/autorizacion-salida.entity';
import { Matricula } from '../../config/entities/academico/matricula.entity';
import { HorarioCurso } from '../../config/entities/academico/horario-curso.entity';
import { Curso } from '../../config/entities/academico/curso.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Profesor } from '../../config/entities/academico/profesor.entity';
import { Acudiente } from '../../config/entities/academico/acudiente.entity';
import { Usuario } from '../../config/entities/usuarios/usuario.entity';
import { Estado } from '../../config/entities/catalogos/estado.entity';
import { Colegio } from '../../config/entities/colegio/colegio.entity';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { TelegramApiModule } from '../../telegram_bot/telegram-api.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventoAsistencia,
      TarjetaNfc,
      TarjetaDesconocida,
      LectorNfc,
      AsistenciaDiaria,
      Excusa,
      AutorizacionSalida,
      Matricula,
      HorarioCurso,
      Curso,
      Estudiante,
      Profesor,
      Acudiente,
      Usuario,
      Estado,
      Colegio,
    ]),
    WhatsappModule,
    // Para notificar por Telegram al rector/coordinador/director de grupo
    // cuando se marca a un estudiante como "evadido" (ver registrarManual).
    // Se importa el módulo de bajo nivel (sin lógica de conversación ni de
    // whitelist) para no depender de TelegramBotModule, que a su vez importa
    // este mismo AsistenciaModule (evita una dependencia circular).
    TelegramApiModule,
  ],
  controllers: [
    AsistenciaController,
    AsistenciaConsultaController,
    ExcusasController,
    AutorizacionesSalidaController,
  ],
  providers: [AsistenciaService, ExcusasService, AutorizacionesSalidaService],
  // Los tres se exportan para que el bot de Telegram (TelegramBotModule)
  // pueda reutilizar el resumen diario, obtenerEvadidosHoy(), las excusas
  // pendientes y las autorizaciones de salida del día sin duplicar consultas.
  exports: [AsistenciaService, ExcusasService, AutorizacionesSalidaService],
})
export class AsistenciaModule {}