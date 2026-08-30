import { Module } from '@nestjs/common';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaService } from './asistencia.service';

@Module({
  controllers: [AsistenciaController],
  providers: [AsistenciaService]
})
export class AsistenciaModule {}
