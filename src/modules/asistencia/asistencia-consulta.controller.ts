import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AsistenciaService } from './asistencia.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('asistencia')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AsistenciaConsultaController {
  constructor(private readonly asistenciaService: AsistenciaService) {}

  @Get('diaria')
  @Roles('admin', 'rector', 'coordinador', 'profesor')
  listarAsistenciaDiaria(@Query('fecha') fecha?: string) {
    return this.asistenciaService.listarAsistenciaDiaria(fecha);
  }
}