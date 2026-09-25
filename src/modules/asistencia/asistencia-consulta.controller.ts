import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AsistenciaService } from './asistencia.service';
import { FiltrarAsistenciaDiariaDto } from './dto/filtrar-asistencia-diaria.dto';
import { RegistrarAsistenciaManualDto } from './dto/registrar-asistencia-manual.dto';
import { DeshacerRegistroManualDto } from './dto/deshacer-registro-manual.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';

const ROLES_LECTURA = ['admin', 'rector', 'coordinador', 'profesor'];
const ROLES_GESTION = ['admin', 'rector', 'coordinador'];
// El registro manual admite además a "profesor", pero solo para marcar
// entrada (el sistema decide presente/tarde), salida o evadido — nunca
// presente/tarde/ausente/excusado directamente. La restricción al
// tipoRegistro se hace dentro del propio AsistenciaService.registrarManual
// (buscar rolSolicitante === 'profesor').
const ROLES_REGISTRO_MANUAL = ['admin', 'rector', 'coordinador', 'profesor'];

@Controller('asistencia')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AsistenciaConsultaController {
  constructor(private readonly asistenciaService: AsistenciaService) {}

  // (2026-09-25) Antes usaba ROLES_LECTURA (incluye profesor). La pantalla
  // Asistencias ya está restringida a admin/rector/coordinador en el menú y
  // en el router del frontend -- un profesor no debería poder pedir el
  // listado completo de asistencia de TODO el colegio. GET /resumen y
  // GET /curso/:cursoId/resumen se quedan en ROLES_LECTURA a propósito: el
  // primero solo da conteos agregados (lo usa el Dashboard de Inicio, que
  // profesor sí ve) y el segundo ya viene acotado a un solo curso por la
  // URL (lo usa Cursos → detalle de curso, que profesor también ve).
  @Get('diaria')
  @Roles(...ROLES_GESTION)
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
  @Roles(...ROLES_REGISTRO_MANUAL)
  @Auditar('registrar_asistencia_manual', 'asistencia_diaria')
  registrarManual(@Body() dto: RegistrarAsistenciaManualDto, @Req() request: any) {
    return this.asistenciaService.registrarManual(dto, request.usuario.sub, request.usuario.rol);
  }

  // (2026-09-25) Deshace la corrección manual más reciente de hoy para un
  // estudiante -- mismos roles que pueden registrar manualmente, ver
  // AsistenciaService.deshacerRegistroManual para las restricciones reales
  // por rol y por tipo de registro.
  @Post('diaria/deshacer')
  @Roles(...ROLES_REGISTRO_MANUAL)
  @Auditar('deshacer_asistencia_manual', 'asistencia_diaria')
  deshacerManual(@Body() dto: DeshacerRegistroManualDto, @Req() request: any) {
    return this.asistenciaService.deshacerRegistroManual(dto.estudianteId, request.usuario.rol);
  }
}
