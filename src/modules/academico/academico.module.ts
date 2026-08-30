import { Module } from '@nestjs/common';
import { AcademicoController } from './academico.controller';
import { AcademicoService } from './academico.service';

@Module({
  controllers: [AcademicoController],
  providers: [AcademicoService]
})
export class AcademicoModule {}
