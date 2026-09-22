import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EventoAsistencia, TipoEvento } from '../../config/entities/nfc/evento-asistencia.entity';
import { TarjetaNfc, TipoTitular } from '../../config/entities/nfc/tarjeta-nfc.entity';
import { TarjetaDesconocida } from '../../config/entities/nfc/tarjeta-desconocida.entity';
import { LectorNfc } from '../../config/entities/nfc/lector-nfc.entity';
import { AsistenciaDiaria, OrigenAsistencia } from '../../config/entities/asistencia/asistencia-diaria.entity';
import { Matricula } from '../../config/entities/academico/matricula.entity';
import { HorarioCurso } from '../../config/entities/academico/horario-curso.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Profesor } from '../../config/entities/academico/profesor.entity';
import { Curso } from '../../config/entities/academico/curso.entity';
import { Usuario } from '../../config/entities/usuarios/usuario.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { RegistrarEventoDto } from './dto/registrar-evento.dto';
import { FiltrarAsistenciaDiariaDto, VistaAsistencia } from './dto/filtrar-asistencia-diaria.dto';
import { RegistrarAsistenciaManualDto, TipoRegistroManual } from './dto/registrar-asistencia-manual.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { TelegramApiService } from '../../telegram_bot/telegram-api.service';

@Injectable()
export class AsistenciaService {
  private readonly logger = new Logger(AsistenciaService.name);

  constructor(
    @InjectRepository(EventoAsistencia) private readonly eventoRepository: Repository<EventoAsistencia>,
    @InjectRepository(TarjetaNfc) private readonly tarjetaRepository: Repository<TarjetaNfc>,
    @InjectRepository(TarjetaDesconocida) private readonly tarjetaDesconocidaRepository: Repository<TarjetaDesconocida>,
    @InjectRepository(AsistenciaDiaria) private readonly asistenciaDiariaRepository: Repository<AsistenciaDiaria>,
    @InjectRepository(Matricula) private readonly matriculaRepository: Repository<Matricula>,
    @InjectRepository(HorarioCurso) private readonly horarioCursoRepository: Repository<HorarioCurso>,
    @InjectRepository(Estudiante) private readonly estudianteRepository: Repository<Estudiante>,
    @InjectRepository(Profesor) private readonly profesorRepository: Repository<Profesor>,
    @InjectRepository(Curso) private readonly cursoRepository: Repository<Curso>,
    @InjectRepository(Usuario) private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>,
    private readonly whatsappService: WhatsappService,
    private readonly telegramApiService: TelegramApiService,
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
    const tarjeta = await this.tarjetaRepository.findOne({
      where: { uidTarjeta: dto.id_tarjeta },
      relations: ['estado'],
    });
    if (!tarjeta) {
      // No se cambia la respuesta que recibe el ESP32 (sigue siendo el mismo
      // 404 de siempre, sin tocar el firmware) — solo se deja un registro
      // para que la pantalla Carnets pueda ofrecer este UID al asignar un
      // carnet nuevo, en vez de tener que copiarlo a mano de la tarjeta física.
      await this.tarjetaDesconocidaRepository.save(
        this.tarjetaDesconocidaRepository.create({ uidTarjeta: dto.id_tarjeta, lectorId: lector.id }),
      );
      throw new NotFoundException('Tarjeta no reconocida.');
    }

    if (lector.codigoLector !== dto.id_lector) {
      throw new NotFoundException('El id_lector no coincide con la api key usada.');
    }

    // Bloqueo de carnet o de su titular (2026-09-22): un carnet reportado
    // como perdido/dañado, o un estudiante/profesor suspendido, se
    // desactivan poniendo su estado en algo distinto de "activa"/"activo"
    // — nunca borrando la fila (se necesita conservar el historial). El
    // ESP32 ya sabe reproducir el sonido de "rechazado" ante cualquier
    // 403 (ver enviarEvento() en el firmware), así que basta con
    // rechazar aquí: no hizo falta tocar el firmware para este punto.
    if (tarjeta.estado?.codigo !== 'activa') {
      throw new ForbiddenException('El carnet está inactivo o bloqueado.');
    }

    let titularBloqueado = false;
    if (tarjeta.tipoTitular === TipoTitular.ESTUDIANTE && tarjeta.estudianteId) {
      const estudiante = await this.estudianteRepository.findOne({
        where: { id: tarjeta.estudianteId },
        relations: ['estado'],
      });
      titularBloqueado = !estudiante || estudiante.estado?.codigo !== 'activo';
    } else if (tarjeta.tipoTitular === TipoTitular.PROFESOR && tarjeta.profesorId) {
      const profesor = await this.profesorRepository.findOne({
        where: { id: tarjeta.profesorId },
        relations: ['estado'],
      });
      titularBloqueado = !profesor || profesor.estado?.codigo !== 'activo';
    }

    if (titularBloqueado) {
      throw new ForbiddenException('El titular de este carnet está inactivo.');
    }

    const ahora = new Date();

    const ultimoEvento = await this.eventoRepository.findOne({
      where: { tarjetaId: tarjeta.id },
      order: { timestampEvento: 'DESC' },
    });

    // Ventana anti-duplicado (2026-09-22): si la última lectura de esta
    // misma tarjeta fue una ENTRADA hace menos de 15 minutos, esta nueva
    // lectura se trata como un reintento de esa misma entrada (por
    // ejemplo, el estudiante volvió a acercar el carnet porque no vio la
    // luz verde) y NO se registra como salida — sin esto, cualquier doble
    // lectura accidental marcaba salida minutos después de la entrada
    // real. No se crea un evento nuevo ni se toca asistencia_diaria; el
    // lector igual queda en verde/aceptado (HTTP 201) porque la tarjeta
    // sigue siendo válida.
    const VENTANA_ANTI_DUPLICADO_MS = 15 * 60 * 1000;
    const esReintentoDeEntrada =
      !!ultimoEvento &&
      ultimoEvento.tipoEvento === TipoEvento.ENTRADA &&
      ahora.getTime() - ultimoEvento.timestampEvento.getTime() < VENTANA_ANTI_DUPLICADO_MS;

    if (esReintentoDeEntrada) {
      return {
        evento: ultimoEvento!.id,
        tipoEvento: ultimoEvento!.tipoEvento,
        timestamp: ultimoEvento!.timestampEvento,
        duplicado: true,
      };
    }

    // Corrección (2026-09-07): antes se comparaba ultimoEvento.timestampEvento
    // contra "new Date().setHours(0,0,0,0)", que calcula la medianoche en la
    // zona horaria del propio proceso de Node (normalmente UTC en el
    // servidor), no en la de Bogotá. Bogotá es UTC-5, así que la medianoche
    // UTC cae 5 horas antes que la medianoche real de Bogotá: cualquier
    // "entrada" registrada entre la medianoche de Bogotá y las 7:00 p.m.
    // (cuando de verdad cambia el día en UTC) dejaba de contar como "del
    // mismo día" mucho antes de que en Bogotá cambiara de fecha, y el
    // sistema volvía a marcar "entrada" en vez de "salida" al pasar la
    // tarjeta otra vez esa misma noche. Se compara la fecha calendario en
    // Bogotá de los dos eventos, igual que ya hace el resto de este
    // servicio (ver obtenerFechaBogota, usado en toda la clase).
    const esMismoDia = !!ultimoEvento && this.obtenerFechaBogota(ultimoEvento.timestampEvento) === this.obtenerFechaBogota(ahora);
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

  /**
   * Evadidos de todo el colegio en una fecha (por defecto hoy) — a diferencia
   * de `obtenerResumenCurso`, que ya calculaba esto pero solo para un curso a
   * la vez, este método no filtra por curso. Se usa desde el bot de Telegram
   * (comando "evadidos") y queda disponible para cualquier otro consumidor
   * que necesite la lista global.
   */
  async obtenerEvadidosHoy(fecha?: string) {
    const fechaFiltro = fecha ?? this.obtenerFechaBogota(new Date());
    const anioLectivo = new Date().getFullYear();

    const totalMatriculados = await this.matriculaRepository.count({ where: { anioLectivo } });

    const registros = await this.asistenciaDiariaRepository
      .createQueryBuilder('ad')
      .innerJoinAndSelect('ad.estudiante', 'estudiante')
      .innerJoin('ad.estado', 'estado')
      .leftJoinAndSelect('estudiante.matriculas', 'matricula', 'matricula.anioLectivo = :anioLectivo', {
        anioLectivo,
      })
      .leftJoinAndSelect('matricula.curso', 'curso')
      .where('ad.fecha = :fecha', { fecha: fechaFiltro })
      .andWhere('estado.codigo = :codigo', { codigo: 'evadido' })
      .orderBy('curso.nombre', 'ASC')
      .addOrderBy('estudiante.apellidos', 'ASC')
      .getMany();

    const estudiantes = registros.map((registro) => ({
      id: registro.estudiante.id,
      nombres: registro.estudiante.nombres,
      apellidos: registro.estudiante.apellidos,
      curso: registro.estudiante.matriculas?.[0]?.curso?.nombre ?? null,
    }));

    const porcentaje = totalMatriculados > 0 ? Math.round((estudiantes.length / totalMatriculados) * 100) : 0;

    return {
      fecha: fechaFiltro,
      valor: estudiantes.length,
      porcentaje,
      estudiantes,
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

  /**
   * `rolSolicitante` viene del JWT (request.usuario.rol). Un profesor puede
   * usar este endpoint únicamente para marcar "entrada" (el sistema decide
   * presente/tarde automáticamente, igual que el flujo NFC), "salida" o
   * "evadido" (ver AsistenciaConsultaController) — para cualquier otro
   * tipoRegistro, esta es una segunda barrera además de @Roles, por si el
   * endpoint cambiara. Puede aplicarse a cualquier estudiante del colegio.
   */
  async registrarManual(
    dto: RegistrarAsistenciaManualDto,
    usuarioId: string,
    rolSolicitante: string,
  ): Promise<AsistenciaDiaria> {
    const TIPOS_PERMITIDOS_PROFESOR = [
      TipoRegistroManual.ENTRADA,
      TipoRegistroManual.SALIDA,
      TipoRegistroManual.EVADIDO,
    ];
    if (rolSolicitante === 'profesor' && !TIPOS_PERMITIDOS_PROFESOR.includes(dto.tipoRegistro)) {
      throw new ForbiddenException(
        'Un profesor solo puede usar el registro manual para marcar entrada, salida o "evadido".',
      );
    }

    const estudiante = await this.estudianteRepository.findOne({ where: { id: dto.estudianteId } });
    if (!estudiante) {
      throw new NotFoundException('El estudiante indicado no existe.');
    }

    const fecha = dto.fecha ?? this.obtenerFechaBogota(new Date());
    const horaTexto = dto.hora ?? this.obtenerHoraActualBogota();
    const instante = this.construirInstanteBogota(fecha, `${horaTexto}:00`);

    let existente = await this.asistenciaDiariaRepository.findOne({
      where: { estudianteId: estudiante.id, fecha },
      relations: ['estado'],
    });

    if (dto.tipoRegistro === TipoRegistroManual.ENTRADA) {
      // El sistema decide presente/tarde automáticamente, igual que el
      // flujo de ingesta NFC (ver actualizarAsistenciaDiaria) — el profesor
      // nunca elige directamente presente/tarde/ausente/excusado.
      const estado = await this.calcularEstadoEntrada(estudiante.id, fecha, instante);

      if (!existente) {
        existente = this.asistenciaDiariaRepository.create({ estudianteId: estudiante.id, fecha });
      }

      existente.estado = estado;
      existente.horaEntrada = instante;
      existente.eventoEntradaId = null;
    } else if (dto.tipoRegistro === TipoRegistroManual.SALIDA) {
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
    } else if (dto.tipoRegistro === TipoRegistroManual.EVADIDO) {
      // Regla de negocio: "evadido" solo aplica a un estudiante que SÍ llegó
      // al colegio hoy (ya tiene un registro de entrada presente/tarde) pero
      // luego no está donde debería (por ejemplo, un profesor revisa su
      // salón y no lo encuentra). Nunca se puede marcar evadido a alguien
      // que nunca llegó — eso sigue siendo "ausente".
      if (!existente || !['presente', 'tarde'].includes(existente.estado?.codigo)) {
        throw new ConflictException(
          'Solo se puede marcar como "evadido" a un estudiante que ya tiene registrada su llegada (presente o tarde) hoy.',
        );
      }

      const estado = await this.buscarEstado(dto.tipoRegistro);
      existente.estado = estado;
      // A diferencia de ausente/excusado, aquí NO se borra horaEntrada ni
      // eventoEntradaId: son la evidencia de que el estudiante sí llegó, y
      // se conservan para la notificación y para cualquier reporte futuro.
    } else {
      const estado = await this.buscarEstado(dto.tipoRegistro);

      if (!existente) {
        existente = this.asistenciaDiariaRepository.create({ estudianteId: estudiante.id, fecha });
      }

      existente.estado = estado;
      existente.eventoEntradaId = null;
      existente.horaEntrada =
        dto.tipoRegistro === TipoRegistroManual.AUSENTE || dto.tipoRegistro === TipoRegistroManual.EXCUSADO
          ? null
          : instante;
    }

    existente.origen = OrigenAsistencia.CORRECCION_MANUAL;
    existente.verificadoPorUsuarioId = usuarioId;
    existente.fechaVerificacion = new Date();
    existente.observacionVerificacion = dto.observacion;

    const guardado = await this.asistenciaDiariaRepository.save(existente);

    if (dto.tipoRegistro === TipoRegistroManual.EVADIDO) {
      // Best-effort: si Telegram falla, la marca de evadido ya quedó
      // guardada — solo se registra el error en el log, nunca se revierte
      // ni se le muestra un error al profesor por esto.
      this.notificarEvadido(estudiante, guardado, usuarioId).catch((error) => {
        this.logger.error(`No se pudo notificar por Telegram el evadido del estudiante ${estudiante.id}`, error);
      });
    }

    return guardado;
  }

  /**
   * Notifica por Telegram cuando un estudiante es marcado como evadido.
   * Decisión de negocio (confirmada 2026-09-22): el rector ya NO forma
   * parte de este flujo automático. Solo se avisa al director de grupo
   * del curso actual del estudiante, con un botón para que él mismo
   * decida si hace falta escalarlo al coordinador — así no se satura a
   * coordinación con casos que el director de grupo puede resolver
   * verificando él mismo (por ejemplo, el estudiante estaba en otro salón
   * autorizado). Si no hay director de grupo asignado al curso, o el que
   * hay no ha vinculado su Telegram (o está inactivo), se avisa
   * directamente al coordinador como respaldo, dejando explícito en el
   * mensaje que no se pudo verificar primero con el director de grupo.
   * Solo llegan al usuario que ya vinculó su cuenta de Telegram
   * (telegramChatId no nulo) — a nadie más se le puede escribir por este
   * medio. No lanza errores hacia quien la llama: cualquier fallo queda
   * únicamente en el log.
   */
  private async notificarEvadido(
    estudiante: Estudiante,
    registro: AsistenciaDiaria,
    marcadoPorUsuarioId: string,
  ): Promise<void> {
    const anioLectivo = new Date().getFullYear();

    const matricula = await this.matriculaRepository.findOne({
      where: { estudianteId: estudiante.id, anioLectivo },
      relations: ['curso', 'curso.profesorDirector'],
    });

    const marcadoPor = await this.usuarioRepository.findOne({ where: { id: marcadoPorUsuarioId } });
    const nombreQuienMarco = marcadoPor?.nombreCompleto ?? 'un profesor';

    const horaEntradaTexto = registro.horaEntrada ? this.formatearHoraBogota(registro.horaEntrada) : 'desconocida';
    const cursoNombre = matricula?.curso?.nombre ?? 'sin curso asignado';

    let director: Usuario | null = null;
    if (matricula?.curso?.profesorDirector) {
      director = await this.usuarioRepository.findOne({
        where: { profesorId: matricula.curso.profesorDirector.id },
        relations: ['estado'],
      });
    }

    const directorDisponible = !!(director && director.estado?.codigo === 'activo' && director.telegramChatId);

    if (directorDisponible) {
      const mensaje = `
🚪 Estudiante evadido — verifícalo

Hola profesor(a) ${director!.nombreCompleto}, tu estudiante ${estudiante.nombres} ${estudiante.apellidos} de ${cursoNombre} fue marcado como EVADIDO por ${nombreQuienMarco}.

Hora de llegada registrada: ${horaEntradaTexto}
Fecha: ${registro.fecha}
Observación: ${registro.observacionVerificacion ?? '(sin observación)'}

Por favor verifica esta acción. ¿Deseas que lo reporte al coordinador?
      `.trim();

      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '📣 Sí, reportar al coordinador',
              callback_data: `evadido_escalar:${estudiante.id}:${registro.id}`,
            },
          ],
        ],
      };

      try {
        await this.telegramApiService.enviarMensaje(director!.telegramChatId as string, mensaje, replyMarkup);
      } catch (error) {
        this.logger.error(`No se pudo notificar al director de grupo sobre el evadido ${estudiante.id}`, error);
      }
      return;
    }

    // Respaldo: no hay director de grupo asignado o verificado — se avisa
    // directo al coordinador, sin botón de escalar (ya es la notificación
    // final).
    const coordinadores = await this.buscarCoordinadoresNotificables();
    if (coordinadores.length === 0) {
      return;
    }

    const mensaje = `
🚪 Estudiante evadido (sin director de grupo disponible)

Estudiante: ${estudiante.nombres} ${estudiante.apellidos}
Curso: ${cursoNombre}
Marcado por: ${nombreQuienMarco}
Hora de llegada registrada: ${horaEntradaTexto}
Fecha: ${registro.fecha}
Observación: ${registro.observacionVerificacion ?? '(sin observación)'}

⚠️ No fue posible avisar primero al director de grupo (no está asignado al curso, o no ha vinculado su Telegram) — se te notifica directamente.
    `.trim();

    await Promise.all(
      coordinadores.map((coordinador) =>
        this.telegramApiService.enviarMensaje(coordinador.telegramChatId as string, mensaje).catch((error) => {
          this.logger.error(`No se pudo notificar al coordinador ${coordinador.id} sobre un evadido`, error);
        }),
      ),
    );
  }

  /**
   * Escala a coordinador un evadido que el director de grupo decidió
   * reportar (botón "Sí, reportar al coordinador" del mensaje de
   * Telegram). Se expone como método público porque quien recibe el
   * callback_query del botón es TelegramBotService (ver
   * telegram_bot.service.ts) — el webhook de Telegram le llega a él, no a
   * este servicio — así que la lógica de negocio se centraliza aquí en
   * vez de duplicarla allá. Vuelve a validar todo desde cero (no confía
   * en nada que venga del botón salvo los IDs) por si el registro cambió
   * de estado entre que se mandó el mensaje y que se presionó el botón,
   * o por si alguien que no es el director de grupo real llegara a
   * disparar este callback.
   */
  async escalarEvadidoACoordinador(
    estudianteId: string,
    asistenciaDiariaId: string,
    solicitanteUsuarioId: string,
  ): Promise<{ ok: boolean; razon?: 'ya_escalado' | 'no_aplica' | 'no_autorizado' }> {
    const registro = await this.asistenciaDiariaRepository.findOne({
      where: { id: asistenciaDiariaId, estudianteId },
      relations: ['estado'],
    });

    if (!registro || registro.estado?.codigo !== 'evadido') {
      return { ok: false, razon: 'no_aplica' };
    }

    if (registro.evadidoEscaladoCoordinador) {
      return { ok: false, razon: 'ya_escalado' };
    }

    const anioLectivo = new Date().getFullYear();
    const matricula = await this.matriculaRepository.findOne({
      where: { estudianteId, anioLectivo },
      relations: ['curso', 'curso.profesorDirector'],
    });

    const solicitante = await this.usuarioRepository.findOne({ where: { id: solicitanteUsuarioId } });
    const esDirectorDelCurso =
      !!matricula?.curso?.profesorDirector &&
      !!solicitante?.profesorId &&
      solicitante.profesorId === matricula.curso.profesorDirector.id;

    if (!esDirectorDelCurso) {
      return { ok: false, razon: 'no_autorizado' };
    }

    const estudiante = await this.estudianteRepository.findOne({ where: { id: estudianteId } });
    if (!estudiante) {
      return { ok: false, razon: 'no_aplica' };
    }

    const coordinadores = await this.buscarCoordinadoresNotificables();
    const horaEntradaTexto = registro.horaEntrada ? this.formatearHoraBogota(registro.horaEntrada) : 'desconocida';

    const mensaje = `
📣 Evadido reportado por el director de grupo

Estudiante: ${estudiante.nombres} ${estudiante.apellidos}
Curso: ${matricula?.curso?.nombre ?? 'sin curso asignado'}
Hora de llegada registrada: ${horaEntradaTexto}
Fecha: ${registro.fecha}

El director de grupo verificó la situación y pidió reportarla al coordinador.
    `.trim();

    await Promise.all(
      coordinadores.map((coordinador) =>
        this.telegramApiService.enviarMensaje(coordinador.telegramChatId as string, mensaje).catch((error) => {
          this.logger.error(
            `No se pudo notificar al coordinador ${coordinador.id} sobre la escalación de un evadido`,
            error,
          );
        }),
      ),
    );

    registro.evadidoEscaladoCoordinador = true;
    await this.asistenciaDiariaRepository.save(registro);

    return { ok: true };
  }

  private async buscarCoordinadoresNotificables(): Promise<Usuario[]> {
    return this.usuarioRepository
      .createQueryBuilder('usuario')
      .innerJoin('usuario.rol', 'rol')
      .innerJoin('usuario.estado', 'estado')
      .where('estado.codigo = :codigo', { codigo: 'activo' })
      .andWhere('usuario.telegramChatId IS NOT NULL')
      .andWhere('rol.nombre = :rol', { rol: 'coordinador' })
      .getMany();
  }

  // ---------- Utilidades ----------

  /**
   * Determina si una "entrada" manual (registrada por un profesor desde
   * Carnets, sin tarjeta NFC) cuenta como "presente" o "tarde", replicando
   * el mismo umbral que usa el flujo automático de NFC
   * (actualizarAsistenciaDiaria) — implementado como método separado para
   * no arriesgar ese flujo, ya en producción.
   */
  private async calcularEstadoEntrada(estudianteId: string, fecha: string, instante: Date): Promise<Estado> {
    const anioLectivo = new Date().getFullYear();
    const matricula = await this.matriculaRepository.findOne({
      where: { estudianteId, anioLectivo },
      relations: ['curso'],
    });

    let codigoEstado = 'presente';

    if (matricula?.curso) {
      const diaSemana = this.obtenerDiaSemanaBogota(instante);
      const horario = await this.horarioCursoRepository.findOne({
        where: { cursoId: matricula.curso.id, diaSemana },
      });

      if (horario) {
        const limiteEntrada = this.sumarMinutos(
          this.construirInstanteBogota(fecha, horario.horaEntrada),
          horario.minutosToleranciaTardanza,
        );
        codigoEstado = instante.getTime() <= limiteEntrada.getTime() ? 'presente' : 'tarde';
      }
    }

    return this.buscarEstado(codigoEstado);
  }

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
    return this.formatearHoraBogota(new Date());
  }

  /** Igual que obtenerHoraActualBogota, pero para un instante arbitrario (por
   * ejemplo, la horaEntrada guardada de un registro) en vez de "ahora". */
  private formatearHoraBogota(fecha: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(fecha);
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
