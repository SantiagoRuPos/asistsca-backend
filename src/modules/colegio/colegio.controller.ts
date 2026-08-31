import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ColegioService } from './colegio.service';
import { CrearColegioDto } from './dto/crear-colegio.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('colegio')
export class ColegioController {
  constructor(private readonly colegioService: ColegioService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  crear(@Body() dto: CrearColegioDto) {
    return this.colegioService.crear(dto);
  }
}