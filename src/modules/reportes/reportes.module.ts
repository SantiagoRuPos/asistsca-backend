import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { AsistenciaDiaria } from '../../config/entities/asistencia/asistencia-diaria.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Matricula } from '../../config/entities/academico/matricula.entity';
import { Curso } from '../../config/entities/academico/curso.entity';
import { Colegio } from '../../config/entities/colegio/colegio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AsistenciaDiaria, Estudiante, Matricula, Curso, Colegio])],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
