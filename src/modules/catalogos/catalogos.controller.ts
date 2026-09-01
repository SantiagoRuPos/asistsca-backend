import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CatalogosService } from './catalogos.service';
import { CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('catalogos')
@UseGuards(JwtAuthGuard)
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  @Get('estados')
  listarEstados(@Query('categoria') categoria?: CategoriaEstado) {
    return this.catalogosService.listarEstados(categoria);
  }
}
