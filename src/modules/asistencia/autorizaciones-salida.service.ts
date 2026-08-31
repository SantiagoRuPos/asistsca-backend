import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutorizacionSalida } from '../../config/entities/asistencia/autorizacion-salida.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Acudiente } from '../../config/entities/academico/acudiente.entity';
import { Matricula } from '../../config/entities/academico/matricula.entity';
import { Usuario } from '../../config/entities/usuarios/usuario.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { CrearAutorizacionSalidaDto } from './dto/crear-autorizacion-salida.dto';

interface UsuarioActual {
  sub: string;
  rol: string;
}

@Injectable()
export class AutorizacionesSalidaService {
  constructor(
    @InjectRepository(AutorizacionSalida) private readonly autorizacionRepository: Repository<AutorizacionSalida>,
    @InjectRepository(Estudiante) private readonly estudianteRepository: Repository<Estudiante>,
    @InjectRepository(Acudiente) private readonly acudienteRepository: Repository<Acudiente>,
    @InjectRepository(Matricula) private readonly matriculaRepository: Repository<Matricula>,
    @InjectRepository(Usuario) private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>,
  ) {}

  async crear(dto: CrearAutorizacionSalidaDto, usuarioActual: UsuarioActual) {
    const estudiante = await this.estudianteRepository.findOne({ where: { id: dto.estudianteId } });
    if (!estudiante) {
      throw new NotFoundException('El estudiante no existe.');
    }

    const acudiente = await this.acudienteRepository.findOne({ where: { id: dto.acudienteAutorizaId } });
    if (!acudiente) {
      throw new NotFoundException('El acudiente no existe.');
    }

    await this.validarPermisoParaAutorizar(dto.estudianteId, usuarioActual);

    const estadoAutorizada = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.AUTORIZACION_SALIDA, codigo: 'autorizada' },
    });
    if (!estadoAutorizada) {
      throw new ConflictException('Falta el seed del estado autorizacion_salida/autorizada.');
    }

    const autorizacion = this.autorizacionRepository.create({
      estudianteId: dto.estudianteId,
      fecha: dto.fecha,
      horaAutorizada: dto.horaAutorizada,
      acudienteAutorizaId: dto.acudienteAutorizaId,
      nombrePersonaRecoge: dto.nombrePersonaRecoge,
      motivo: dto.motivo,
      autorizadoPorUsuarioId: usuarioActual.sub,
      estado: estadoAutorizada,
    });

    return this.autorizacionRepository.save(autorizacion);
  }

  async listar(estudianteId?: string, fecha?: string) {
    return this.autorizacionRepository.find({
      where: {
        ...(estudianteId ? { estudianteId } : {}),
        ...(fecha ? { fecha } : {}),
      },
      relations: ['estudiante', 'acudienteAutoriza', 'autorizadoPorUsuario', 'estado'],
      order: { fechaRegistro: 'DESC' },
    });
  }

  async marcarUtilizada(id: string) {
    const autorizacion = await this.autorizacionRepository.findOne({ where: { id }, relations: ['estado'] });
    if (!autorizacion) {
      throw new NotFoundException('La autorización no existe.');
    }

    if (autorizacion.estado.codigo !== 'autorizada') {
      throw new ConflictException(
        `Esta autorización está en estado '${autorizacion.estado.codigo}', no se puede marcar como utilizada.`,
      );
    }

    const estadoUtilizada = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.AUTORIZACION_SALIDA, codigo: 'utilizada' },
    });
    if (!estadoUtilizada) {
      throw new ConflictException('Falta el seed del estado autorizacion_salida/utilizada.');
    }

    autorizacion.estado = estadoUtilizada;
    return this.autorizacionRepository.save(autorizacion);
  }

  private async validarPermisoParaAutorizar(estudianteId: string, usuarioActual: UsuarioActual) {
    if (['admin', 'rector', 'coordinador'].includes(usuarioActual.rol)) {
      return;
    }

    if (usuarioActual.rol !== 'profesor') {
      throw new ForbiddenException('Tu rol no puede autorizar salidas anticipadas.');
    }

    const usuario = await this.usuarioRepository.findOne({ where: { id: usuarioActual.sub } });
    if (!usuario?.profesorId) {
      throw new ForbiddenException('Tu usuario no está vinculado a un profesor.');
    }

    const matricula = await this.matriculaRepository.findOne({
      where: { estudianteId },
      order: { anioLectivo: 'DESC' },
      relations: ['curso'],
    });

    if (!matricula || matricula.curso.profesorDirectorId !== usuario.profesorId) {
      throw new ForbiddenException(
        'Solo el director de grupo del curso de este estudiante puede autorizar su salida.',
      );
    }
  }
}