import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EventoAsistencia, TipoEvento } from '../../config/entities/nfc/evento-asistencia.entity';
import { TarjetaNfc, TipoTitular } from '../../config/entities/nfc/tarjeta-nfc.entity';
import { LectorNfc } from '../../config/entities/nfc/lector-nfc.entity';
import { AsistenciaDiaria, OrigenAsistencia } from '../../config/entities/asistencia/asistencia-diaria.entity';
import { Matricula } from '../../config/entities/academico/matricula.entity';
import { HorarioCurso } from '../../config/entities/academico/horario-curso.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Curso } from '../../config/entities/academico/curso.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { RegistrarEventoDto } from './dto/registrar-evento.dto';
import { FiltrarAsistenciaDiariaDto, VistaAsistencia } from './dto/filtrar-asistencia-diaria.dto';
import { RegistrarAsistenciaManualDto, TipoRegistroManual } from './dto/registrar-asistencia-manual.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class AsistenciaService {
  constructor(
    @InjectRepository(EventoAsistencia) private readonly eventoRepository: Repository<EventoAsistencia>,
    @InjectRepository(TarjetaNfc) private readonly tarjetaRepository: Repository<TarjetaNfc>,
    @InjectRepository(AsistenciaDiaria) private readonly asistenciaDiariaRepository: Repository<AsistenciaDiaria>,
    @InjectRepository(Matricula) private readonly matriculaRepository: Repository<Matricula>,
    @InjectRepository(HorarioCurso) private readonly horarioCursoRepository: Repository<HorarioCurso>,
    @InjectRepository(Estudiante) private readonly estudianteRepository: Repository<Estudiante>,
    @InjectRepository(Curso) private readonly cursoRepository: Repository<Curso>,
    @InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>,
    private readonly whatsappService: WhatsappService,
  ) {}

  // ---------- Ingesta NFC (sin cambios de comportamiento) ----------

  /**
   * Usado por el firmware del ESP32 para confirmar que tiene conexión con el
   * servidor (y que su API key sigue siendo válida) sin registrar ningún
   * evento de asistencia. `lector` ya viene validado por LectorApiKeyGuard,
   * que también ya actualizó `ultimaConexion` — este método solo arma la
   * respuesta, no vuelve a tocar la base de datos.
   */
  obtenerHealthLector(lector: LectorNfc) {
    return {
      ok: true,
      estadoServidor: 'en_linea',
      fechaServidor: new Date().toISOString(),
      lector: {
        id: lector.id,
        codigoLector: lector.codigoLector,
        nombre: lector.nombre,
      },
    };
  }

  async registrarEvento(dto: RegistrarEventoDto, lector: LectorNfc) {
    const tarjeta = await this.tarjetaRepository.findOne({ where: { uidTarjeta: dto.id_tarjeta } });
    if (!tarjeta) {
      throw new NotFoundException('Tarjeta no reconocida.');
    }

    if (lector.codigoLector !== dto.id_lector) {
      throw new NotFoundException('El id_lector no coincide con la api key usada.');
    }

    const ahora = new Date();
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    const ultimoEvento = await this.eventoRepository.findOne({
      where: { tarjetaId: tarjeta.id },
      order: { timestampEvento: 'DESC' },
    });

    const esMismoDia = ultimoEvento && ultimoEvento.timestampEvento >= inicioDelDia;
    const tipoEvento =
      esMismoDia && ultimoEvento!.tipoEvento === TipoEvento.ENTRADA ? TipoEvento.SALIDA : TipoEvento.ENTRADA;

    const evento = this.eventoRepository.create({
      tarjeta,
      lector,
      tipoEvento,
      timestampEvento: ahora,
    });
    const eventoGuardado = await this.eventoRepository.save(evento);

    let asistencia: AsistenciaDiaria | null = null;
    if (tarjeta.tipoTitular === TipoTitular.ESTUDIANTE && tarjeta.estudianteId) {
      asistencia = await this.actualizarAsistenciaDiaria(tarjeta.estudianteId, eventoGuardado);
      void this.whatsappService.notificarEvento(tarjeta.estudianteId, eventoGuardado);
    }

    return {
      evento: eventoGuardado.id,
      tipoEvento: eventoGuardado.tipoEvento,
      timestamp: eventoGuardado.timestampEvento,
      asistencia: asistencia
        ? { fecha: asistencia.fecha, estadoId: asistencia.estadoId, salidaAnticipada: asistencia.salidaAnticipada }
        : undefined,
    };
  }

  private async actualizarAsistenciaDiaria(estudianteId: string, evento: EventoAsistencia): Promise<AsistenciaDiaria | null> {
    const fechaBogota = this.obtenerFechaBogota(evento.timestampEvento);
    const diaSemana = this.obtenerDiaSemanaBogota(evento.timestampEvento);

    const matricula = await this.matriculaRepository.findOne({
      where: { estudianteId },
      order: { anioLectivo: 'DESC' },
      relations: ['curso'],
    });

    if (!matricula) {
      return null;
    }

    const horario = await this.horarioCursoRepository.findOne({
      where: { cursoId: matricula.curso.id, diaSemana },
    });

    let existente = await this.asistenciaDiariaRepository.findOne({
      where: { estudianteId, fecha: fechaBogota },
    });

    if (evento.tipoEvento === TipoEvento.ENTRADA) {
      let codigoEstado = 'presente';

      if (horario) {
        const limiteEntrada = this.sumarMinutos(
          this.construirInstanteBogota(fechaBogota, horario.horaEntrada),
          horario.minutosToleranciaTardanza,
        );
        codigoEstado = evento.timestampEvento.getTime() <= limiteEntrada.getTime() ? 'presente' : 'tarde';
      }

      const estado = await this.buscarEstado(codigoEstado);
      if (!estado) {
        return null;
      }

      if (!existente) {
        existente = this.asistenciaDiariaRepository.create({ estudianteId, fecha: fechaBogota });
      }

      existente.estado = estado;
      existente.horaEntrada = evento.timestampEvento;
      existente.eventoEntradaId = evento.id;
      existente.origen = OrigenAsistencia.NFC_AUTOMATICO;

      return this.asistenciaDiariaRepository.save(existente);
    }

    if (!existente) {
      const estadoPresente = await this.buscarEstado('presente');
      if (!estadoPresente) return null;

      existente = this.asistenciaDiariaRepository.create({
        estudianteId,
        fecha: fechaBogota,
        estado: estadoPresente,
        origen: OrigenAsistencia.NFC_AUTOMATICO,
      });
    }

    existente.horaSalida = evento.timestampEvento;
    existente.eventoSalidaId = evento.id;

    if (horario) {
      const horaSalidaEsperada = this.construirInstanteBogota(fechaBogota, horario.horaSalida);
      existente.salidaAnticipada = evento.timestampEvento.getTime() < horaSalidaEsperada.getTime();
    }

    return this.asistenciaDiariaRepository.save(existente);
  }

  // ---------- Consulta para el frontend ----------

  async listarAsistenciaDiaria(filtros: FiltrarAsistenciaDiariaDto) {
    const anioLectivo = new Date().getFullYear();
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 10;

    const qb = this.asistenciaDiariaRepository
      .createQueryBuilder('ad')
      .leftJoinAndSelect('ad.estudiante', 'estudiante')
      .leftJoinAndSelect('ad.estado', 'estado')
      .leftJoinAndSelect('ad.eventoEntrada', 'eventoEntrada')
      .leftJoinAndSelect('eventoEntrada.lector', 'lectorEntrada')
      .leftJoinAndSelect('ad.eventoSalida', 'eventoSalida')
      .leftJoinAndSelect('eventoSalida.lector', 'lectorSalida')
      .leftJoinAndSelect('estudiante.matriculas', 'matricula', 'matricula.anioLectivo = :anioLectivo', { anioLectivo })
      .leftJoinAndSelect('matricula.curso', 'curso');

    if (filtros.fechaInicio && filtros.fechaFin) {
      qb.andWhere('ad.fecha BETWEEN :fechaInicio AND :fechaFin', {
        fechaInicio: filtros.fechaInicio,
        fechaFin: filtros.fechaFin,
      });
    } else {
      qb.andWhere('ad.fecha = :fecha', { fecha: filtros.fecha ?? this.obtenerFechaBogota(new Date()) });
    }

    if (filtros.cursoId) {
      qb.andWhere('curso.id = :cursoId', { cursoId: filtros.cursoId });
    }

    if (filtros.estado) {
      qb.andWhere('estado.codigo = :estadoCodigo', { estadoCodigo: filtros.estado });
    }

    if (filtros.q) {
      qb.andWhere(
        '(estudiante.nombres ILIKE :q OR estudiante.apellidos ILIKE :q OR estudiante.numeroDocumento ILIKE :q)',
        { q: `%${filtros.q}%` },
      );
    }

    if (filtros.lectorId) {
      qb.andWhere('(lectorEntrada.id = :lectorId OR lectorSalida.id = :lectorId)', { lectorId: filtros.lectorId });
    }

    if (filtros.vista === VistaAsistencia.ENTRADAS) {
      qb.andWhere('ad.horaEntrada IS NOT NULL');
    } else if (filtros.vista === VistaAsistencia.SALIDAS) {
      qb.andWhere('ad.horaSalida IS NOT NULL');
    }

    qb.orderBy('estudiante.apellidos', 'ASC').addOrderBy('estudiante.nombres', 'ASC');
    qb.skip((pagina - 1) * limite).take(limite);

    const [registros, total] = await qb.getManyAndCount();

    const datos = registros.map((registro) => {
      const curso = registro.estudiante.matriculas?.[0]?.curso ?? null;
      return {
        id: registro.id,
        fecha: registro.fecha,
        estudiante: {
          id: registro.estudiante.id,
          nombres: registro.estudiante.nombres,
          apellidos: registro.estudiante.apellidos,
          numeroDocumento: registro.estudiante.numeroDocumento,
        },
        curso: curso ? { id: curso.id, nombre: curso.nombre } : null,
        estado: { codigo: registro.estado.codigo, nombre: registro.estado.nombre },
        horaEntrada: registro.horaEntrada,
        horaSalida: registro.horaSalida,
        salidaAnticipada: registro.salidaAnticipada,
        puntoRegistro:
          registro.eventoEntrada?.lector?.descripcionUbicacion ??
          registro.eventoSalida?.lector?.descripcionUbicacion ??
          null,
        origen: registro.origen,
      };
    });

    return {
      datos,
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    };
  }

  async obtenerResumenDiario(fecha?: string) {
    const fechaFiltro = fecha ?? this.obtenerFechaBogota(new Date());
    const anioLectivo = new Date().getFullYear();

    const totalMatriculados = await this.matriculaRepository.count({ where: { anioLectivo } });

    const registros = await this.asistenciaDiariaRepository.find({
      where: { fecha: fechaFiltro },
      relations: ['estado'],
    });

    const entraron = registros.filter((r) => r.horaEntrada !== null).length;
    const tardanzas = registros.filter((r) => r.estado?.codigo === 'tarde').length;
    const ausencias = registros.filter((r) => r.estado?.codigo === 'ausente').length;
    const salieron = registros.filter((r) => r.horaSalida !== null).length;

    const porcentaje = (valor: number) => (totalMatriculados > 0 ? Math.round((valor / totalMatriculados) * 100) : 0);

    return {
      fecha: fechaFiltro,
      totalMatriculados,
      entraron: { valor: entraron, porcentaje: porcentaje(entraron) },
      tardanzas: { valor: tardanzas, porcentaje: porcentaje(tardanzas) },
      ausencias: { valor: ausencias, porcentaje: porcentaje(ausencias) },
      salieron: { valor: salieron, porcentaje: porcentaje(salieron) },
    };
  }

  // ---------- Resumen de asistencia por curso (vista "Cursos > detalle") ----------

  async obtenerResumenCurso(cursoId: string, fecha?: string) {
    const fechaFiltro = fecha ?? this.obtenerFechaBogota(new Date());
    const anioLectivo = new Date().getFullYear();

    const curso = await this.cursoRepository.findOne({
      where: { id: cursoId },
      relations: ['profesorDirector'],
    });
    if (!curso) {
      throw new NotFoundException('El curso indicado no existe.');
    }

    const matriculas = await this.matriculaRepository.find({
      where: { cursoId, anioLectivo },
      relations: ['estudiante'],
    });

    const estudianteIds = matriculas.map((m) => m.estudianteId);

    const registrosHoy = estudianteIds.length
      ? await this.asistenciaDiariaRepository.find({
          where: { fecha: fechaFiltro, estudianteId: In(estudianteIds) },
          relations: ['estado', 'eventoEntrada', 'eventoEntrada.lector'],
        })
      : [];

    const registroPorEstudiante = new Map(registrosHoy.map((registro) => [registro.estudianteId, registro]));

    type FilaBasica = { id: string; nombres: string; apellidos: string };
    type FilaConHora = FilaBasica & { horaEntrada: Date | null; puntoRegistro: string | null };

    const llegaron: FilaConHora[] = [];
    const llegaronTarde: FilaConHora[] = [];
    const noHanLlegado: FilaBasica[] = [];
    const evadidos: FilaBasica[] = [];

    for (const matricula of matriculas) {
      const estudiante = matricula.estudiante;
      const base: FilaBasica = { id: estudiante.id, nombres: estudiante.nombres, apellidos: estudiante.apellidos };
      const registro = registroPorEstudiante.get(estudiante.id);

      if (!registro) {
        noHanLlegado.push(base);
        continue;
      }

      switch (registro.estado.codigo) {
        case 'presente':
          llegaron.push({
            ...base,
            horaEntrada: registro.horaEntrada,
            puntoRegistro: registro.eventoEntrada?.lector?.descripcionUbicacion ?? null,
          });
          break;
        case 'tarde':
          llegaronTarde.push({
            ...base,
            horaEntrada: registro.horaEntrada,
            puntoRegistro: registro.eventoEntrada?.lector?.descripcionUbicacion ?? null,
          });
          break;
        case 'evadido':
          evadidos.push(base);
          break;
        default:
          // ausente / excusado registrados manualmente sin entrada: para esta vista cuentan como "no ha llegado"
          noHanLlegado.push(base);
      }
    }

    const total = matriculas.length;
    const porcentaje = (valor: number) => (total > 0 ? Math.round((valor / total) * 100) : 0);

    return {
      curso: {
        id: curso.id,
        nombre: curso.nombre,
        jornada: curso.jornada,
        director: { nombres: curso.profesorDirector.nombres, apellidos: curso.profesorDirector.apellidos },
      },
      fecha: fechaFiltro,
      totalMatriculados: total,
      llegaron: { valor: llegaron.length, porcentaje: porcentaje(llegaron.length), estudiantes: llegaron },
      llegaronTarde: {
        valor: llegaronTarde.length,
        porcentaje: porcentaje(llegaronTarde.length),
        estudiantes: llegaronTarde,
      },
      noHanLlegado: {
        valor: noHanLlegado.length,
        porcentaje: porcentaje(noHanLlegado.length),
        estudiantes: noHanLlegado,
      },
      evadidos: { valor: evadidos.length, porcentaje: porcentaje(evadidos.length), estudiantes: evadidos },
    };
  }

  // ---------- Registro manual (staff, sin tarjeta NFC) ----------

  async registrarManual(dto: RegistrarAsistenciaManualDto, usuarioId: string): Promise<AsistenciaDiaria> {
    const estudiante = await this.estudianteRepository.findOne({ where: { id: dto.estudianteId } });
    if (!estudiante) {
      throw new NotFoundException('El estudiante indicado no existe.');
    }

    const fecha = dto.fecha ?? this.obtenerFechaBogota(new Date());
    const horaTexto = dto.hora ?? this.obtenerHoraActualBogota();
    const instante = this.construirInstanteBogota(fecha, `${horaTexto}:00`);

    let existente = await this.asistenciaDiariaRepository.findOne({ where: { estudianteId: estudiante.id, fecha } });

    if (dto.tipoRegistro === TipoRegistroManual.SALIDA) {
      if (!existente) {
        const estadoPresente = await this.buscarEstado('presente');
        existente = this.asistenciaDiariaRepository.create({
          estudianteId: estudiante.id,
          fecha,
          estado: estadoPresente,
        });
      }
      existente.horaSalida = instante;
      existente.eventoSalidaId = null;
    } else {
      const estado = await this.buscarEstado(dto.tipoRegistro);

      if (!existente) {
        existente = this.asistenciaDiariaRepository.create({ estudianteId: estudiante.id, fecha });
      }

      existente.estado = estado;
      existente.eventoEntradaId = null;
      existente.horaEntrada =
        dto.tipoRegistro === TipoRegistroManual.AUSENTE ||
        dto.tipoRegistro === TipoRegistroManual.EXCUSADO ||
        dto.tipoRegistro === TipoRegistroManual.EVADIDO
          ? null
          : instante;
    }

    existente.origen = OrigenAsistencia.CORRECCION_MANUAL;
    existente.verificadoPorUsuarioId = usuarioId;
    existente.fechaVerificacion = new Date();
    existente.observacionVerificacion = dto.observacion;

    return this.asistenciaDiariaRepository.save(existente);
  }

  // ---------- Utilidades ----------

  private async buscarEstado(codigo: string): Promise<Estado> {
    const estado = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.ASISTENCIA_DIARIA, codigo },
    });
    if (!estado) {
      throw new NotFoundException(`No existe el estado "${codigo}" de asistencia_diaria en la tabla estados (falta el seed).`);
    }
    return estado;
  }

  private obtenerFechaBogota(fecha: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(fecha);
  }

  private obtenerHoraActualBogota(): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  }

  private obtenerDiaSemanaBogota(fecha: Date): number {
    const dia = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', weekday: 'short' }).format(fecha);
    const mapa: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return mapa[dia];
  }

  private construirInstanteBogota(fechaYMD: string, horaHHmmss: string): Date {
    return new Date(`${fechaYMD}T${horaHHmmss}-05:00`);
  }

  private sumarMinutos(fecha: Date, minutos: number): Date {
    return new Date(fecha.getTime() + minutos * 60000);
  }
}
