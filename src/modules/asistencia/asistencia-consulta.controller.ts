import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AsistenciaService } from './asistencia.service';
import { FiltrarAsistenciaDiariaDto } from './dto/filtrar-asistencia-diaria.dto';
import { RegistrarAsistenciaManualDto } from './dto/registrar-asistencia-manual.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';

const ROLES_LECTURA = ['admin', 'rector', 'coordinador', 'profesor'];
const ROLES_GESTION = ['admin', 'rector', 'coordinador'];

@Controller('asistencia')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AsistenciaConsultaController {
  constructor(private readonly asistenciaService: AsistenciaService) {}

  @Get('diaria')
  @Roles(...ROLES_LECTURA)
  listarAsistenciaDiaria(@Query() filtros: FiltrarAsistenciaDiariaDto) {
    return this.asistenciaService.listarAsistenciaDiaria(filtros);
  }

  @Get('resumen')
  @Roles(...ROLES_LECTURA)
  obtenerResumen(@Query('fecha') fecha?: string) {
    return this.asistenciaService.obtenerResumenDiario(fecha);
  }

  @Get('curso/:cursoId/resumen')
  @Roles(...ROLES_LECTURA)
  obtenerResumenCurso(@Param('cursoId', ParseUUIDPipe) cursoId: string, @Query('fecha') fecha?: string) {
    return this.asistenciaService.obtenerResumenCurso(cursoId, fecha);
  }

  @Post('diaria/manual')
  @Roles(...ROLES_GESTION)
  @Auditar('registrar_asistencia_manual', 'asistencia_diaria')
  registrarManual(@Body() dto: RegistrarAsistenciaManualDto, @Req() request: any) {
    return this.asistenciaService.registrarManual(dto, request.usuario.sub);
  }
}
