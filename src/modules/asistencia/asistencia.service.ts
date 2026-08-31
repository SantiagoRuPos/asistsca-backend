import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventoAsistencia, TipoEvento } from '../../config/entities/nfc/evento-asistencia.entity';
import { TarjetaNfc, TipoTitular } from '../../config/entities/nfc/tarjeta-nfc.entity';
import { LectorNfc } from '../../config/entities/nfc/lector-nfc.entity';
import { AsistenciaDiaria, OrigenAsistencia } from '../../config/entities/asistencia/asistencia-diaria.entity';
import { Matricula } from '../../config/entities/academico/matricula.entity';
import { HorarioCurso } from '../../config/entities/academico/horario-curso.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { RegistrarEventoDto } from './dto/registrar-evento.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class AsistenciaService {
  constructor(
    @InjectRepository(EventoAsistencia) private readonly eventoRepository: Repository<EventoAsistencia>,
    @InjectRepository(TarjetaNfc) private readonly tarjetaRepository: Repository<TarjetaNfc>,
    @InjectRepository(AsistenciaDiaria) private readonly asistenciaDiariaRepository: Repository<AsistenciaDiaria>,
    @InjectRepository(Matricula) private readonly matriculaRepository: Repository<Matricula>,
    @InjectRepository(HorarioCurso) private readonly horarioCursoRepository: Repository<HorarioCurso>,
    @InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>,
    private readonly whatsappService: WhatsappService,
  ) {}

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

  async listarAsistenciaDiaria(fecha?: string) {
    const fechaFiltro = fecha ?? this.obtenerFechaBogota(new Date());

    return this.asistenciaDiariaRepository.find({
      where: { fecha: fechaFiltro },
      relations: ['estudiante', 'estado'],
      order: { fecha: 'DESC' },
    });
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

      const estado = await this.estadoRepository.findOne({
        where: { categoria: CategoriaEstado.ASISTENCIA_DIARIA, codigo: codigoEstado },
      });
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
      const estadoPresente = await this.estadoRepository.findOne({
        where: { categoria: CategoriaEstado.ASISTENCIA_DIARIA, codigo: 'presente' },
      });
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

  private obtenerFechaBogota(fecha: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
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