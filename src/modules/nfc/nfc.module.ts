import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NfcService } from './nfc.service';
import { NfcController } from './nfc.controller';
import { LectorNfc } from '../../config/entities/nfc/lector-nfc.entity';
import { TarjetaNfc } from '../../config/entities/nfc/tarjeta-nfc.entity';
import { TarjetaDesconocida } from '../../config/entities/nfc/tarjeta-desconocida.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Profesor } from '../../config/entities/academico/profesor.entity';
import { Estado } from '../../config/entities/catalogos/estado.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LectorNfc, TarjetaNfc, TarjetaDesconocida, Estudiante, Profesor, Estado])],
  providers: [NfcService],
  controllers: [NfcController],
})
export class NfcModule {}