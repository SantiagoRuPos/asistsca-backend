import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaService } from './asistencia.service';
import { EventoAsistencia } from '../../config/entities/nfc/evento-asistencia.entity';
import { TarjetaNfc } from '../../config/entities/nfc/tarjeta-nfc.entity';
import { LectorNfc } from '../../config/entities/nfc/lector-nfc.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EventoAsistencia, TarjetaNfc, LectorNfc])],
  controllers: [AsistenciaController],
  providers: [AsistenciaService],
})
export class AsistenciaModule {}