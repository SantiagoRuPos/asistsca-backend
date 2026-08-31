import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { LectorNfc } from '../../config/entities/nfc/lector-nfc.entity';
import { TarjetaNfc, TipoTitular } from '../../config/entities/nfc/tarjeta-nfc.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Profesor } from '../../config/entities/academico/profesor.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { CrearLectorDto } from './dto/crear-lector.dto';
import { AsignarTarjetaDto } from './dto/asignar-tarjeta.dto';

@Injectable()
export class NfcService {
  constructor(
    @InjectRepository(LectorNfc) private readonly lectorRepository: Repository<LectorNfc>,
    @InjectRepository(TarjetaNfc) private readonly tarjetaRepository: Repository<TarjetaNfc>,
    @InjectRepository(Estudiante) private readonly estudianteRepository: Repository<Estudiante>,
    @InjectRepository(Profesor) private readonly profesorRepository: Repository<Profesor>,
    @InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>,
  ) {}

  async crearLector(dto: CrearLectorDto) {
    const duplicado = await this.lectorRepository.findOne({ where: { codigoLector: dto.codigoLector.trim() } });
    if (duplicado) {
      throw new ConflictException('Ya existe un lector con ese código.');
    }

    const estadoActivo = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.LECTOR, codigo: 'activo' },
    });
    if (!estadoActivo) {
      throw new ConflictException('No existe el estado activo de lector en la tabla estados (falta el seed).');
    }

    const apiKey = randomBytes(32).toString('hex');
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    const lector = this.lectorRepository.create({
      codigoLector: dto.codigoLector.trim(),
      descripcionUbicacion: dto.descripcionUbicacion?.trim() ?? null,
      apiKeyHash,
      estado: estadoActivo,
    });
    const guardado = await this.lectorRepository.save(lector);

    // La api key en texto plano solo se devuelve esta vez — queda guardado el hash, no se puede recuperar después.
    return { lector: guardado, apiKey };
  }

  async listarLectores() {
    return this.lectorRepository.find({ relations: ['estado'], order: { fechaRegistro: 'DESC' } });
  }

  async asignarTarjeta(dto: AsignarTarjetaDto) {
    const duplicada = await this.tarjetaRepository.findOne({ where: { uidTarjeta: dto.uidTarjeta.trim() } });
    if (duplicada) {
      throw new ConflictException('Ya existe una tarjeta con ese UID.');
    }

    let estudiante: Estudiante | null = null;
    let profesor: Profesor | null = null;

    if (dto.tipoTitular === TipoTitular.ESTUDIANTE) {
      estudiante = await this.estudianteRepository.findOne({ where: { id: dto.estudianteId } });
      if (!estudiante) {
        throw new ConflictException('El estudiante indicado no existe.');
      }
      const yaTiene = await this.tarjetaRepository.findOne({ where: { estudianteId: estudiante.id } });
      if (yaTiene) {
        throw new ConflictException('Este estudiante ya tiene una tarjeta asignada.');
      }
    } else {
      profesor = await this.profesorRepository.findOne({ where: { id: dto.profesorId } });
      if (!profesor) {
        throw new ConflictException('El profesor indicado no existe.');
      }
      const yaTiene = await this.tarjetaRepository.findOne({ where: { profesorId: profesor.id } });
      if (yaTiene) {
        throw new ConflictException('Este profesor ya tiene una tarjeta asignada.');
      }
    }

    const estadoActiva = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.TARJETA, codigo: 'activa' },
    });
    if (!estadoActiva) {
      throw new ConflictException('No existe el estado "activa" de tarjeta en la tabla estados (falta el seed).');
    }

    const tarjeta = this.tarjetaRepository.create({
      uidTarjeta: dto.uidTarjeta.trim(),
      tipoTitular: dto.tipoTitular,
      estudiante,
      profesor,
      estado: estadoActiva,
    });

    return this.tarjetaRepository.save(tarjeta);
  }

  async listarTarjetas() {
    return this.tarjetaRepository.find({
      relations: ['estudiante', 'profesor', 'estado'],
      order: { fechaAsignacion: 'DESC' },
    });
  }
}