import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaConsultaController } from './asistencia-consulta.controller';
import { ExcusasController } from './excusas.controller';
import { AsistenciaService } from './asistencia.service';
import { ExcusasService } from './excusas.service';
import { EventoAsistencia } from '../../config/entities/nfc/evento-asistencia.entity';
import { TarjetaNfc } from '../../config/entities/nfc/tarjeta-nfc.entity';
import { LectorNfc } from '../../config/entities/nfc/lector-nfc.entity';
import { AsistenciaDiaria } from '../../config/entities/asistencia/asistencia-diaria.entity';
import { Excusa } from '../../config/entities/asistencia/excusa.entity';
import { Matricula } from '../../config/entities/academico/matricula.entity';
import { HorarioCurso } from '../../config/entities/academico/horario-curso.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Estado } from '../../config/entities/catalogos/estado.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventoAsistencia,
      TarjetaNfc,
      LectorNfc,
      AsistenciaDiaria,
      Excusa,
      Matricula,
      HorarioCurso,
      Estudiante,
      Estado,
    ]),
  ],
  controllers: [AsistenciaController, AsistenciaConsultaController, ExcusasController],
  providers: [AsistenciaService, ExcusasService],
})
export class AsistenciaModule {}