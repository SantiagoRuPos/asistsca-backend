import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AcademicoService } from './academico.service';
import { CrearProfesorDto } from './dto/crear-profesor.dto';
import { CrearCursoDto } from './dto/crear-curso.dto';
import { CambiarDirectorCursoDto } from './dto/cambiar-director-curso.dto';
import { CrearHorarioCursoDto } from './dto/crear-horario-curso.dto';
import { CrearEstudianteDto } from './dto/crear-estudiante.dto';
import { CrearAcudienteDto } from './dto/crear-acudiente.dto';
import { MatricularEstudianteDto } from './dto/matricular-estudiante.dto';
import { FiltrarEstudiantesDto } from './dto/filtrar-estudiantes.dto';
import { RegistrarEstudianteCompletoDto } from './dto/registrar-estudiante-completo.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

const ROLES_GESTION = ['admin', 'rector', 'coordinador'];
const ROLES_LECTURA = ['admin', 'rector', 'coordinador', 'profesor'];

@Controller('academico')
export class AcademicoController {
  constructor(private readonly academicoService: AcademicoService) {}

  // Antes solo admin/coordinador podían crear profesores. Se agregó "rector"
  // porque la pantalla Usuarios (que ahora también registra profesores desde
  // el modal "Nuevo usuario") solo la pueden abrir admin/rector — un rector
  // habría recibido 403 al intentar registrar un profesor desde ahí.
  @Post('profesores')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'rector', 'coordinador')
  crearProfesor(@Body() dto: CrearProfesorDto) {
    return this.academicoService.crearProfesor(dto);
  }

  @Post('cursos')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  crearCurso(@Body() dto: CrearCursoDto) {
    return this.academicoService.crearCurso(dto);
  }

  @Get('cursos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_LECTURA)
  listarCursos() {
    return this.academicoService.listarCursos();
  }

  @Patch('cursos/:id/director')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  cambiarDirector(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarDirectorCursoDto) {
    return this.academicoService.cambiarDirectorCurso(id, dto);
  }

  @Post('cursos/:id/horarios')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  crearHorario(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CrearHorarioCursoDto) {
    return this.academicoService.crearHorarioCurso(id, dto);
  }

  @Get('cursos/:id/horarios')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_LECTURA)
  listarHorarios(@Param('id', ParseUUIDPipe) id: string) {
    return this.academicoService.listarHorariosCurso(id);
  }

  @Post('estudiantes')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  crearEstudiante(@Body() dto: CrearEstudianteDto) {
    return this.academicoService.crearEstudiante(dto);
  }

  @Post('estudiantes/completo')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  registrarEstudianteCompleto(@Body() dto: RegistrarEstudianteCompletoDto) {
    return this.academicoService.registrarEstudianteCompleto(dto);
  }

  @Post('acudientes')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  crearAcudiente(@Body() dto: CrearAcudienteDto) {
    return this.academicoService.crearAcudiente(dto);
  }

  @Post('matriculas')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  matricular(@Body() dto: MatricularEstudianteDto) {
    return this.academicoService.matricularEstudiante(dto);
  }

  @Get('estudiantes/resumen')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_LECTURA)
  obtenerResumenEstudiantes() {
    return this.academicoService.obtenerResumenEstudiantes();
  }

  @Get('estudiantes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_LECTURA)
  listarEstudiantes(@Query() filtros: FiltrarEstudiantesDto) {
    return this.academicoService.listarEstudiantes(filtros);
  }

  @Get('estudiantes/activos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_LECTURA)
  listarEstudiantesActivos() {
    return this.academicoService.listarEstudiantesActivos();
  }

  @Get('estudiantes/matriculados')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_LECTURA)
  listarEstudiantesMatriculados() {
    return this.academicoService.listarEstudiantesMatriculados();
  }

  @Post('estudiantes/masivo')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  crearEstudiantesMasivo(@Body() body: { estudiantes: unknown[] }) {
    return this.academicoService.crearEstudiantesMasivo(body?.estudiantes ?? []);
  }
}