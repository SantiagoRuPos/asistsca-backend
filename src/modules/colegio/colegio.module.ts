import { Module } from '@nestjs/common';
import { ColegioService } from './colegio.service';

@Module({
  providers: [ColegioService]
})
export class ColegioModule {}
