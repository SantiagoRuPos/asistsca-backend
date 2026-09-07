import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workbook, Worksheet } from 'exceljs';
import { AsistenciaDiaria } from '../../config/entities/asistencia/asistencia-diaria.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Matricula } from '../../config/entities/academico/matricula.entity';
import { Curso } from '../../config/entities/academico/curso.entity';
import { Colegio } from '../../config/entities/colegio/colegio.entity';
import { InformeEstudianteQueryDto } from './dto/informe-estudiante-query.dto';
import { InformeCursoQueryDto } from './dto/informe-curso-query.dto';
import { InformeColegioQueryDto } from './dto/informe-colegio-query.dto';

// Un informe que abarque más de un año lectivo completo no tiene mucho
// sentido para este sistema (las matrículas y horarios son por año lectivo)
// y podría convertirse en una consulta muy pesada sin querer — se limita el
// rango como medida de seguridad/rendimiento, no porque se haya pedido.
const RANGO_MAXIMO_DIAS = 366;

const COLOR_NAVY = 'FF000F22';
const COLOR_TEAL = 'FF0D9488';
const COLOR_TEAL_CLARO = 'FFE6FBF8';
const COLOR_GRIS_CLARO = 'FFF3F4F6';
const COLOR_BORDE = 'FFD1D5DB';

interface ConteoEstadisticas {
  totalRegistros: number;
  presente: number;
  tarde: number;
  ausente: number;
  excusado: number;
  evadido: number;
  conSalidaRegistrada: number;
}

function conteoVacio(): ConteoEstadisticas {
  return { totalRegistros: 0, presente: 0, tarde: 0, ausente: 0, excusado: 0, evadido: 0, conSalidaRegistrada: 0 };
}

function acumular(conteo: ConteoEstadisticas, registro: AsistenciaDiaria): void {
  conteo.totalRegistros += 1;
  const codigo = registro.estado.codigo;
  if (codigo === 'presente' || codigo === 'tarde' || codigo === 'ausente' || codigo === 'excusado' || codigo === 'evadido') {
    conteo[codigo] += 1;
  }
  if (registro.horaSalida) {
    conteo.conSalidaRegistrada += 1;
  }
}

// % de asistencia = días con llegada registrada (presente o tarde) sobre el
// total de días con algún registro en el período. No existe todavía un
// calendario escolar modelado en el sistema (días hábiles/festivos), así que
// esta es la única base objetiva disponible — igual criterio que ya usa
// GET /asistencia/resumen para el porcentaje de un solo día.
function porcentajeAsistencia(conteo: ConteoEstadisticas): number {
  if (conteo.totalRegistros === 0) return 0;
  return Math.round(((conteo.presente + conteo.tarde) / conteo.totalRegistros) * 1000) / 10;
}

function formatearFechaLarga(fechaYMD: string): string {
  const [anio, mes, dia] = fechaYMD.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(fecha);
}

function formatearFechaHoraBogota(fecha: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(fecha);
}

function formatearHoraBogota(fecha: Date | null): string {
  if (!fecha) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(fecha);
}

const NOMBRES_ESTADO: Record<string, string> = {
  presente: 'Presente',
  tarde: 'Llegó tarde',
  ausente: 'Ausente',
  excusado: 'Excusado',
  evadido: 'Evadido',
};

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(AsistenciaDiaria) private readonly asistenciaDiariaRepository: Repository<AsistenciaDiaria>,
    @InjectRepository(Estudiante) private readonly estudianteRepository: Repository<Estudiante>,
    @InjectRepository(Matricula) private readonly matriculaRepository: Repository<Matricula>,
    @InjectRepository(Curso) private readonly cursoRepository: Repository<Curso>,
    @InjectRepository(Colegio) private readonly colegioRepository: Repository<Colegio>,
  ) {}

  async generarInformeEstudiante(dto: InformeEstudianteQueryDto): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    this.validarRango(dto.fechaInicio, dto.fechaFin);

    const estudiante = await this.estudianteRepository.findOne({ where: { id: dto.estudianteId } });
    if (!estudiante) {
      throw new NotFoundException('El estudiante indicado no existe.');
    }

    const anioLectivo = new Date(`${dto.fechaFin}T00:00:00`).getFullYear();
    const matricula = await this.matriculaRepository.findOne({
      where: { estudianteId: estudiante.id, anioLectivo },
      relations: ['curso'],
    });

    const registros = await this.obtenerRegistros(dto.fechaInicio, dto.fechaFin, { estudianteId: estudiante.id });
    const conteo = conteoVacio();
    for (const registro of registros) acumular(conteo, registro);

    const colegio = await this.obtenerColegio();
    const libro = this.crearLibro();

    const hojaResumen = libro.addWorksheet('Resumen');
    let fila = this.escribirEncabezadoInforme(hojaResumen, colegio, {
      titulo: 'Informe individual de asistencia',
      subtitulo: `${estudiante.nombres} ${estudiante.apellidos} — Documento ${estudiante.numeroDocumento}${
        matricula ? ` — ${matricula.curso.nombre}` : ''
      }`,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
    });
    fila = this.escribirResumenGeneral(hojaResumen, conteo, fila);
    this.ajustarAnchoColumnas(hojaResumen, [30, 16, 16, 16, 16, 16, 16]);

    const hojaDetalle = libro.addWorksheet('Detalle día a día');
    this.escribirDetalleRegistros(hojaDetalle, registros, { incluirEstudiante: false, incluirCurso: false });

    const nombreArchivo = this.nombreArchivo(`informe_${estudiante.nombres}_${estudiante.apellidos}`, dto.fechaInicio, dto.fechaFin);
    return { buffer: await this.finalizarLibro(libro), nombreArchivo };
  }

  async generarInformeCurso(dto: InformeCursoQueryDto): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    this.validarRango(dto.fechaInicio, dto.fechaFin);

    const curso = await this.cursoRepository.findOne({ where: { id: dto.cursoId }, relations: ['profesorDirector'] });
    if (!curso) {
      throw new NotFoundException('El curso indicado no existe.');
    }

    const anioLectivo = new Date(`${dto.fechaFin}T00:00:00`).getFullYear();
    const matriculas = await this.matriculaRepository.find({
      where: { cursoId: curso.id, anioLectivo },
      relations: ['estudiante'],
    });
    const estudiantes = matriculas.map((m) => m.estudiante).sort((a, b) => a.apellidos.localeCompare(b.apellidos));
    const estudianteIds = estudiantes.map((e) => e.id);

    const registros = await this.obtenerRegistros(dto.fechaInicio, dto.fechaFin, { estudianteIds });

    const conteoPorEstudiante = new Map<string, ConteoEstadisticas>();
    for (const estudiante of estudiantes) conteoPorEstudiante.set(estudiante.id, conteoVacio());
    const conteoTotal = conteoVacio();
    for (const registro of registros) {
      acumular(conteoTotal, registro);
      const conteo = conteoPorEstudiante.get(registro.estudianteId);
      if (conteo) acumular(conteo, registro);
    }

    const colegio = await this.obtenerColegio();
    const libro = this.crearLibro();

    const hojaResumen = libro.addWorksheet('Resumen');
    let fila = this.escribirEncabezadoInforme(hojaResumen, colegio, {
      titulo: 'Informe de asistencia por salón',
      subtitulo: `${curso.nombre} — Jornada ${curso.jornada} — Director de grupo: ${curso.profesorDirector.nombres} ${curso.profesorDirector.apellidos}`,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
    });
    fila = this.escribirResumenGeneral(hojaResumen, conteoTotal, fila);
    fila += 1;

    this.escribirTituloSeccion(hojaResumen, fila, 'Detalle por estudiante');
    fila += 1;
    this.escribirTablaDesglose(
      hojaResumen,
      fila,
      'Estudiante',
      estudiantes.map((estudiante) => ({
        etiqueta: `${estudiante.nombres} ${estudiante.apellidos}`,
        referencia: estudiante.numeroDocumento,
        conteo: conteoPorEstudiante.get(estudiante.id)!,
      })),
      'Documento',
    );
    this.ajustarAnchoColumnas(hojaResumen, [30, 18, 12, 12, 12, 12, 12, 12, 14]);

    const hojaDetalle = libro.addWorksheet('Detalle día a día');
    this.escribirDetalleRegistros(hojaDetalle, registros, { incluirEstudiante: true, incluirCurso: false });

    const nombreArchivo = this.nombreArchivo(`informe_salon_${curso.nombre}`, dto.fechaInicio, dto.fechaFin);
    return { buffer: await this.finalizarLibro(libro), nombreArchivo };
  }

  async generarInformeColegio(dto: InformeColegioQueryDto): Promise<{ buffer: Buffer; nombreArchivo: string }> {
    this.validarRango(dto.fechaInicio, dto.fechaFin);

    const anioLectivo = new Date(`${dto.fechaFin}T00:00:00`).getFullYear();
    const cursos = await this.cursoRepository.find({
      where: { anioLectivo },
      relations: ['matriculas', 'matriculas.estudiante'],
      order: { nombre: 'ASC' },
    });

    const estudianteIdsPorCurso = new Map<string, string[]>();
    const todosLosEstudianteIds: string[] = [];
    for (const curso of cursos) {
      const ids = curso.matriculas.map((m) => m.estudiante.id);
      estudianteIdsPorCurso.set(curso.id, ids);
      todosLosEstudianteIds.push(...ids);
    }

    const registros = await this.obtenerRegistros(dto.fechaInicio, dto.fechaFin, { estudianteIds: todosLosEstudianteIds });

    const cursoIdPorEstudianteId = new Map<string, string>();
    for (const curso of cursos) {
      for (const id of estudianteIdsPorCurso.get(curso.id) ?? []) cursoIdPorEstudianteId.set(id, curso.id);
    }

    const conteoPorCurso = new Map<string, ConteoEstadisticas>();
    for (const curso of cursos) conteoPorCurso.set(curso.id, conteoVacio());
    const conteoTotal = conteoVacio();
    for (const registro of registros) {
      acumular(conteoTotal, registro);
      const cursoId = cursoIdPorEstudianteId.get(registro.estudianteId);
      if (cursoId) {
        const conteo = conteoPorCurso.get(cursoId);
        if (conteo) acumular(conteo, registro);
      }
    }

    const colegio = await this.obtenerColegio();
    const libro = this.crearLibro();

    const hojaResumen = libro.addWorksheet('Resumen');
    let fila = this.escribirEncabezadoInforme(hojaResumen, colegio, {
      titulo: 'Informe general de asistencia del colegio',
      subtitulo: `Todos los cursos — ${cursos.length} salones, ${todosLosEstudianteIds.length} estudiantes matriculados (año lectivo ${anioLectivo})`,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
    });
    fila = this.escribirResumenGeneral(hojaResumen, conteoTotal, fila);
    fila += 1;

    this.escribirTituloSeccion(hojaResumen, fila, 'Detalle por salón');
    fila += 1;
    this.escribirTablaDesglose(
      hojaResumen,
      fila,
      'Salón',
      cursos.map((curso) => ({
        etiqueta: curso.nombre,
        referencia: `${estudianteIdsPorCurso.get(curso.id)?.length ?? 0} estudiantes`,
        conteo: conteoPorCurso.get(curso.id)!,
      })),
      'Estudiantes',
    );
    this.ajustarAnchoColumnas(hojaResumen, [24, 18, 12, 12, 12, 12, 12, 12, 14]);

    const hojaDetalle = libro.addWorksheet('Detalle día a día');
    this.escribirDetalleRegistros(hojaDetalle, registros, { incluirEstudiante: true, incluirCurso: true, cursoIdPorEstudianteId, cursos });

    const nombreArchivo = this.nombreArchivo('informe_colegio', dto.fechaInicio, dto.fechaFin);
    return { buffer: await this.finalizarLibro(libro), nombreArchivo };
  }

  // ---------- Consultas ----------

  private async obtenerRegistros(
    fechaInicio: string,
    fechaFin: string,
    filtro: { estudianteId?: string; estudianteIds?: string[] },
  ): Promise<AsistenciaDiaria[]> {
    if (filtro.estudianteIds && filtro.estudianteIds.length === 0) {
      return [];
    }

    const query = this.asistenciaDiariaRepository
      .createQueryBuilder('asistencia')
      .innerJoinAndSelect('asistencia.estudiante', 'estudiante')
      .innerJoinAndSelect('asistencia.estado', 'estado')
      .where('asistencia.fecha BETWEEN :fechaInicio AND :fechaFin', { fechaInicio, fechaFin })
      .orderBy('asistencia.fecha', 'ASC')
      .addOrderBy('estudiante.apellidos', 'ASC');

    if (filtro.estudianteId) {
      query.andWhere('asistencia.estudianteId = :estudianteId', { estudianteId: filtro.estudianteId });
    } else if (filtro.estudianteIds) {
      query.andWhere('asistencia.estudianteId IN (:...estudianteIds)', { estudianteIds: filtro.estudianteIds });
    }

    return query.getMany();
  }

  private async obtenerColegio(): Promise<Colegio | null> {
    const colegios = await this.colegioRepository.find({ take: 1 });
    return colegios[0] ?? null;
  }

  private validarRango(fechaInicio: string, fechaFin: string): void {
    const inicio = new Date(`${fechaInicio}T00:00:00`);
    const fin = new Date(`${fechaFin}T00:00:00`);
    if (inicio.getTime() > fin.getTime()) {
      throw new BadRequestException('fechaInicio no puede ser posterior a fechaFin.');
    }
    const dias = (fin.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000);
    if (dias > RANGO_MAXIMO_DIAS) {
      throw new BadRequestException(`El rango del informe no puede superar ${RANGO_MAXIMO_DIAS} días.`);
    }
  }

  private nombreArchivo(base: string, fechaInicio: string, fechaFin: string): string {
    const normalizar = (texto: string) =>
      texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return `${normalizar(base)}_${fechaInicio}_a_${fechaFin}.xlsx`;
  }

  // ---------- Construcción del libro de Excel ----------

  private crearLibro(): Workbook {
    const libro = new Workbook();
    libro.creator = 'AsistSCA';
    libro.created = new Date();
    return libro;
  }

  private async finalizarLibro(libro: Workbook): Promise<Buffer> {
    const arrayBuffer = await libro.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private escribirEncabezadoInforme(
    hoja: Worksheet,
    colegio: Colegio | null,
    opciones: { titulo: string; subtitulo: string; fechaInicio: string; fechaFin: string },
  ): number {
    hoja.views = [{ showGridLines: false }];

    hoja.mergeCells('A1:H1');
    const celdaColegio = hoja.getCell('A1');
    celdaColegio.value = colegio?.nombre ?? 'AsistSCA';
    celdaColegio.font = { size: 18, bold: true, color: { argb: COLOR_NAVY } };
    hoja.getRow(1).height = 26;

    hoja.mergeCells('A2:H2');
    const celdaTitulo = hoja.getCell('A2');
    celdaTitulo.value = opciones.titulo;
    celdaTitulo.font = { size: 13, bold: true, color: { argb: COLOR_TEAL } };

    hoja.mergeCells('A3:H3');
    const celdaSubtitulo = hoja.getCell('A3');
    celdaSubtitulo.value = opciones.subtitulo;
    celdaSubtitulo.font = { size: 11, italic: true, color: { argb: 'FF4B5563' } };

    hoja.mergeCells('A4:H4');
    const celdaPeriodo = hoja.getCell('A4');
    celdaPeriodo.value = `Período del informe: ${formatearFechaLarga(opciones.fechaInicio)} al ${formatearFechaLarga(opciones.fechaFin)}`;
    celdaPeriodo.font = { size: 10, color: { argb: 'FF374151' } };

    hoja.mergeCells('A5:H5');
    const celdaGenerado = hoja.getCell('A5');
    celdaGenerado.value = `Generado el ${formatearFechaHoraBogota(new Date())} (hora Colombia)`;
    celdaGenerado.font = { size: 9, color: { argb: 'FF9CA3AF' } };

    return 7;
  }

  private escribirTituloSeccion(hoja: Worksheet, fila: number, texto: string): void {
    hoja.mergeCells(`A${fila}:H${fila}`);
    const celda = hoja.getCell(`A${fila}`);
    celda.value = texto;
    celda.font = { size: 12, bold: true, color: { argb: COLOR_NAVY } };
  }

  private escribirResumenGeneral(hoja: Worksheet, conteo: ConteoEstadisticas, filaInicio: number): number {
    this.escribirTituloSeccion(hoja, filaInicio, 'Resumen general del período');

    const filaEncabezado = filaInicio + 1;
    const encabezados = ['Total registros', 'Presente', 'Llegó tarde', 'Ausente', 'Excusado', 'Evadido', '% Asistencia'];
    const filaEncabezadoRef = hoja.getRow(filaEncabezado);
    encabezados.forEach((texto, indice) => {
      const celda = filaEncabezadoRef.getCell(indice + 1);
      celda.value = texto;
      this.estilizarCeldaEncabezado(celda);
    });

    const filaValores = filaInicio + 2;
    const valores = [
      conteo.totalRegistros,
      conteo.presente,
      conteo.tarde,
      conteo.ausente,
      conteo.excusado,
      conteo.evadido,
      porcentajeAsistencia(conteo) / 100,
    ];
    const filaValoresRef = hoja.getRow(filaValores);
    valores.forEach((valor, indice) => {
      const celda = filaValoresRef.getCell(indice + 1);
      celda.value = valor;
      celda.alignment = { horizontal: 'center' };
      celda.border = this.bordeCelda();
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TEAL_CLARO } };
      if (indice === valores.length - 1) {
        celda.numFmt = '0.0%';
        celda.font = { bold: true, color: { argb: COLOR_TEAL } };
      }
    });

    return filaValores + 1;
  }

  private escribirTablaDesglose(
    hoja: Worksheet,
    filaInicio: number,
    etiquetaColumnaPrincipal: string,
    filas: { etiqueta: string; referencia: string; conteo: ConteoEstadisticas }[],
    etiquetaColumnaReferencia: string,
  ): void {
    const encabezados = [etiquetaColumnaPrincipal, etiquetaColumnaReferencia, 'Total', 'Presente', 'Tarde', 'Ausente', 'Excusado', 'Evadido', '% Asistencia'];
    const filaEncabezadoRef = hoja.getRow(filaInicio);
    encabezados.forEach((texto, indice) => {
      const celda = filaEncabezadoRef.getCell(indice + 1);
      celda.value = texto;
      this.estilizarCeldaEncabezado(celda);
    });

    filas.forEach((fila, indiceFila) => {
      const numeroFila = filaInicio + 1 + indiceFila;
      const filaRef = hoja.getRow(numeroFila);
      const valores = [
        fila.etiqueta,
        fila.referencia,
        fila.conteo.totalRegistros,
        fila.conteo.presente,
        fila.conteo.tarde,
        fila.conteo.ausente,
        fila.conteo.excusado,
        fila.conteo.evadido,
        porcentajeAsistencia(fila.conteo) / 100,
      ];
      valores.forEach((valor, indiceColumna) => {
        const celda = filaRef.getCell(indiceColumna + 1);
        celda.value = valor;
        celda.border = this.bordeCelda();
        if (indiceColumna >= 2) celda.alignment = { horizontal: 'center' };
        if (indiceColumna === valores.length - 1) celda.numFmt = '0.0%';
        if (indiceFila % 2 === 1) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GRIS_CLARO } };
      });
    });
  }

  private escribirDetalleRegistros(
    hoja: Worksheet,
    registros: AsistenciaDiaria[],
    opciones: {
      incluirEstudiante: boolean;
      incluirCurso: boolean;
      cursoIdPorEstudianteId?: Map<string, string>;
      cursos?: Curso[];
    },
  ): void {
    hoja.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];

    const columnas: string[] = ['Fecha'];
    if (opciones.incluirEstudiante) columnas.push('Estudiante', 'Documento');
    if (opciones.incluirCurso) columnas.push('Salón');
    columnas.push('Estado', 'Hora entrada', 'Hora salida', 'Observación');

    const filaEncabezado = hoja.getRow(1);
    columnas.forEach((texto, indice) => {
      const celda = filaEncabezado.getCell(indice + 1);
      celda.value = texto;
      this.estilizarCeldaEncabezado(celda);
    });

    const nombreCursoPorId = new Map((opciones.cursos ?? []).map((curso) => [curso.id, curso.nombre]));

    registros.forEach((registro, indiceFila) => {
      const numeroFila = indiceFila + 2;
      const filaRef = hoja.getRow(numeroFila);
      const valores: (string | number)[] = [formatearFechaLarga(registro.fecha)];
      if (opciones.incluirEstudiante) {
        valores.push(`${registro.estudiante.nombres} ${registro.estudiante.apellidos}`, registro.estudiante.numeroDocumento);
      }
      if (opciones.incluirCurso) {
        const cursoId = opciones.cursoIdPorEstudianteId?.get(registro.estudianteId);
        valores.push((cursoId && nombreCursoPorId.get(cursoId)) || '—');
      }
      valores.push(
        NOMBRES_ESTADO[registro.estado.codigo] ?? registro.estado.nombre,
        formatearHoraBogota(registro.horaEntrada),
        formatearHoraBogota(registro.horaSalida),
        registro.observacionVerificacion ?? '',
      );
      valores.forEach((valor, indiceColumna) => {
        const celda = filaRef.getCell(indiceColumna + 1);
        celda.value = valor;
        celda.border = this.bordeCelda();
        if (indiceFila % 2 === 1) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GRIS_CLARO } };
      });
    });

    if (registros.length === 0) {
      hoja.getCell('A2').value = 'No hay registros de asistencia en este período.';
      hoja.getCell('A2').font = { italic: true, color: { argb: 'FF9CA3AF' } };
    }

    const anchoBase = opciones.incluirEstudiante ? [16, 28, 16] : [16];
    const anchoCurso = opciones.incluirCurso ? [16] : [];
    this.ajustarAnchoColumnas(hoja, [...anchoBase, ...anchoCurso, 14, 14, 14, 34]);
  }

  private estilizarCeldaEncabezado(celda: import('exceljs').Cell): void {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
    celda.alignment = { horizontal: 'center', vertical: 'middle' };
    celda.border = this.bordeCelda();
  }

  private bordeCelda(): Partial<import('exceljs').Borders> {
    const estilo = { style: 'thin' as const, color: { argb: COLOR_BORDE } };
    return { top: estilo, left: estilo, bottom: estilo, right: estilo };
  }

  private ajustarAnchoColumnas(hoja: Worksheet, anchos: number[]): void {
    anchos.forEach((ancho, indice) => {
      hoja.getColumn(indice + 1).width = ancho;
    });
  }
}
