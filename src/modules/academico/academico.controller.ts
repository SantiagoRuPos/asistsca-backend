import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AcademicoService } from './academico.service';
import { CrearProfesorDto } from './dto/crear-profesor.dto';
import { CrearCursoDto } from './dto/crear-curso.dto';
import { CambiarDirectorCursoDto } from './dto/cambiar-director-curso.dto';
import { CrearHorarioCursoDto } from './dto/crear-horario-curso.dto';
import { ActualizarHorarioCursoDto } from './dto/actualizar-horario-curso.dto';
import { CrearEstudianteDto } from './dto/crear-estudiante.dto';
import { CrearAcudienteDto } from './dto/crear-acudiente.dto';
import { FiltrarAcudientesDto } from './dto/filtrar-acudientes.dto';
import { ActualizarAcudienteDto } from './dto/actualizar-acudiente.dto';
import { ActualizarAutorizacionDatosDto } from './dto/actualizar-autorizacion-datos.dto';
import { ActualizarContactoAcudienteDto } from './dto/actualizar-contacto-acudiente.dto';
import { VincularAcudienteExistenteDto } from './dto/vincular-acudiente-existente.dto';
import { MatricularEstudianteDto } from './dto/matricular-estudiante.dto';
import { FiltrarEstudiantesDto } from './dto/filtrar-estudiantes.dto';
import { RegistrarEstudianteCompletoDto } from './dto/registrar-estudiante-completo.dto';
import { ActualizarEstudianteDto } from './dto/actualizar-estudiante.dto';
import { CambiarCursoEstudianteDto } from './dto/cambiar-curso-estudiante.dto';
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

  // Para el selector de "director de grupo" al crear/cambiar un curso — no
  // hace falta que lo vea un profesor, solo quien gestiona cursos.
  @Get('profesores')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  listarProfesores() {
    return this.academicoService.listarProfesores();
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

  @Patch('cursos/:id/horarios/:horarioId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  actualizarHorario(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('horarioId', ParseUUIDPipe) horarioId: string,
    @Body() dto: ActualizarHorarioCursoDto,
  ) {
    return this.academicoService.actualizarHorarioCurso(id, horarioId, dto);
  }

  @Delete('cursos/:id/horarios/:horarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  eliminarHorario(@Param('id', ParseUUIDPipe) id: string, @Param('horarioId', ParseUUIDPipe) horarioId: string) {
    return this.academicoService.eliminarHorarioCurso(id, horarioId);
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

  @Get('acudientes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  listarAcudientes(@Query() filtros: FiltrarAcudientesDto) {
    return this.academicoService.listarAcudientes(filtros);
  }

  @Patch('acudientes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  actualizarAcudiente(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarAcudienteDto) {
    return this.academicoService.actualizarAcudiente(id, dto);
  }

  // (2026-10-15) Deja constancia de la autorizacion de tratamiento de datos
  // personales (Ley 1581 de 2012 / Habeas Data) que el acudiente otorga en
  // representacion del menor. El consentimiento real lo recoge el colegio
  // (responsable del tratamiento); este endpoint solo registra el hecho.
  @Patch('acudientes/:id/autorizacion-datos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  actualizarAutorizacionDatos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAutorizacionDatosDto,
  ) {
    return this.academicoService.actualizarAutorizacionDatos(id, dto.autorizado);
  }

  // (2026-09-25) Vincula un acudiente ya existente a un estudiante
  // adicional (hermanos/sobrinos que comparten el mismo acudiente), sin
  // duplicar sus datos creando un registro nuevo.
  @Post('acudientes/:id/vincular')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  vincularAcudienteExistente(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VincularAcudienteExistenteDto) {
    return this.academicoService.vincularAcudienteExistente(id, dto);
  }

  @Patch('estudiantes/:estudianteId/acudientes/:acudienteId/contacto')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  actualizarContactoNotificacion(
    @Param('estudianteId', ParseUUIDPipe) estudianteId: string,
    @Param('acudienteId', ParseUUIDPipe) acudienteId: string,
    @Body() dto: ActualizarContactoAcudienteDto,
  ) {
    return this.academicoService.actualizarContactoNotificacion(estudianteId, acudienteId, dto);
  }

  @Post('matriculas')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  matricular(@Body() dto: MatricularEstudianteDto) {
    return this.academicoService.matricularEstudiante(dto);
  }

  // (2026-09-25) Antes usaban ROLES_LECTURA (incluye profesor). La pantalla
  // Estudiantes ya está restringida a admin/rector/coordinador en el menú y
  // en el router del frontend -- ningún profesor debería poder llegar
  // aquí desde la interfaz. Pero el backend seguía dejando pasar a
  // "profesor" en estos dos endpoints (el listado completo paginado y su
  // resumen), así que alguien con el token de un profesor podía seguir
  // pidiéndolos directo por API y ver el listado completo de TODO el
  // colegio, no solo lo que puede ver desde el menú. Se cierra aquí --
  // los selectores que un profesor sí necesita (crear una excusa, el
  // wizard de estudiantes, etc.) usan /estudiantes/activos y
  // /estudiantes/matriculados, que siguen abiertos a profesor porque son
  // listas simples de nombre+id, no el detalle completo paginado.
  @Get('estudiantes/resumen')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  obtenerResumenEstudiantes() {
    return this.academicoService.obtenerResumenEstudiantes();
  }

  @Get('estudiantes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
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

  @Get('estudiantes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  obtenerEstudiante(@Param('id', ParseUUIDPipe) id: string) {
    return this.academicoService.obtenerEstudiante(id);
  }

  @Patch('estudiantes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  actualizarEstudiante(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarEstudianteDto) {
    return this.academicoService.actualizarEstudiante(id, dto);
  }

  @Patch('estudiantes/:id/curso')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION)
  cambiarCursoEstudiante(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarCursoEstudianteDto) {
    return this.academicoService.cambiarCursoEstudiante(id, dto);
  }
}