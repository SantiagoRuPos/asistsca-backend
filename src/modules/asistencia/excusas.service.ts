import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Excusa } from '../../config/entities/asistencia/excusa.entity';
import { AsistenciaDiaria, OrigenAsistencia } from '../../config/entities/asistencia/asistencia-diaria.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { CrearExcusaDto } from './dto/crear-excusa.dto';

@Injectable()
export class ExcusasService {
  constructor(
    @InjectRepository(Excusa) private readonly excusaRepository: Repository<Excusa>,
    @InjectRepository(AsistenciaDiaria) private readonly asistenciaDiariaRepository: Repository<AsistenciaDiaria>,
    @InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>,
    @InjectRepository(Estudiante) private readonly estudianteRepository: Repository<Estudiante>,
  ) {}

  async crear(dto: CrearExcusaDto, registradoPorUsuarioId: string) {
    const estudiante = await this.estudianteRepository.findOne({ where: { id: dto.estudianteId } });
    if (!estudiante) {
      throw new NotFoundException('El estudiante no existe.');
    }

    const estadoPendiente = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.EXCUSA, codigo: 'pendiente' },
    });
    if (!estadoPendiente) {
      throw new ConflictException('Falta el seed del estado excusa/pendiente.');
    }

    const excusa = this.excusaRepository.create({
      estudianteId: dto.estudianteId,
      fechaAusencia: dto.fechaAusencia,
      motivo: dto.motivo,
      tipoExcusa: dto.tipoExcusa,
      archivoSoporteUrl: dto.archivoSoporteUrl ?? null,
      registradoPorUsuarioId,
      estado: estadoPendiente,
    });

    return this.excusaRepository.save(excusa);
  }

  async listar(estudianteId?: string) {
    return this.excusaRepository.find({
      where: estudianteId ? { estudianteId } : {},
      relations: ['estudiante', 'estado', 'registradoPorUsuario'],
      order: { fechaRegistro: 'DESC' },
    });
  }

  aprobar(id: string, decididoPorUsuarioId: string) {
    return this.decidir(id, 'aprobada', decididoPorUsuarioId);
  }

  rechazar(id: string, decididoPorUsuarioId: string) {
    return this.decidir(id, 'rechazada', decididoPorUsuarioId);
  }

  private async decidir(id: string, codigoDestino: 'aprobada' | 'rechazada', decididoPorUsuarioId: string) {
    const excusa = await this.excusaRepository.findOne({ where: { id }, relations: ['estado'] });
    if (!excusa) {
      throw new NotFoundException('La excusa no existe.');
    }

    if (excusa.estado.codigo !== 'pendiente') {
      throw new ConflictException(`Esta excusa ya fue ${excusa.estado.codigo}, no se puede volver a decidir.`);
    }

    let asistenciaExistente: AsistenciaDiaria | null = null;
    if (codigoDestino === 'aprobada') {
      asistenciaExistente = await this.asistenciaDiariaRepository.findOne({
        where: { estudianteId: excusa.estudianteId, fecha: excusa.fechaAusencia },
      });
      if (asistenciaExistente?.eventoEntradaId) {
        throw new ConflictException(
          'Ese día el estudiante sí registró entrada por NFC; no puede quedar como excusado.',
        );
      }
    }

    const estadoDestino = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.EXCUSA, codigo: codigoDestino },
    });
    if (!estadoDestino) {
      throw new ConflictException(`Falta el seed del estado excusa/${codigoDestino}.`);
    }

    excusa.estado = estadoDestino;
    const excusaGuardada = await this.excusaRepository.save(excusa);

    if (codigoDestino === 'aprobada') {
      await this.marcarAsistenciaComoExcusada(excusa, decididoPorUsuarioId, asistenciaExistente);
    }

    return excusaGuardada;
  }

  private async marcarAsistenciaComoExcusada(
    excusa: Excusa,
    decididoPorUsuarioId: string,
    asistenciaExistente: AsistenciaDiaria | null,
  ) {
    const estadoExcusado = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.ASISTENCIA_DIARIA, codigo: 'excusado' },
    });
    if (!estadoExcusado) {
      return; // la excusa queda aprobada igual; falta el seed de asistencia_diaria/excusado
    }

    const asistencia =
      asistenciaExistente ??
      this.asistenciaDiariaRepository.create({
        estudianteId: excusa.estudianteId,
        fecha: excusa.fechaAusencia,
      });

    asistencia.estado = estadoExcusado;
    asistencia.origen = OrigenAsistencia.CORRECCION_MANUAL;
    asistencia.verificadoPorUsuarioId = decididoPorUsuarioId;
    asistencia.fechaVerificacion = new Date();
    asistencia.observacionVerificacion = `Excusa aprobada: ${excusa.motivo}`;

    await this.asistenciaDiariaRepository.save(asistencia);
  }
}