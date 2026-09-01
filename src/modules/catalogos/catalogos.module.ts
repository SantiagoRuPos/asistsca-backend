import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogosController } from './catalogos.controller';
import { CatalogosService } from './catalogos.service';
import { Estado } from '../../config/entities/catalogos/estado.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Estado])],
  controllers: [CatalogosController],
  providers: [CatalogosService],
})
export class CatalogosModule {}
