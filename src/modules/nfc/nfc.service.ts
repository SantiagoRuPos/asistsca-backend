import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { LectorNfc } from '../../config/entities/nfc/lector-nfc.entity';
import { TarjetaNfc, TipoTitular } from '../../config/entities/nfc/tarjeta-nfc.entity';
import { TarjetaDesconocida } from '../../config/entities/nfc/tarjeta-desconocida.entity';
import { Estudiante } from '../../config/entities/academico/estudiante.entity';
import { Profesor } from '../../config/entities/academico/profesor.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { CrearLectorDto } from './dto/crear-lector.dto';
import { AsignarTarjetaDto } from './dto/asignar-tarjeta.dto';
import { CambiarTarjetaEstudianteDto } from './dto/cambiar-tarjeta-estudiante.dto';

// Ventana de "recién escaneada": una tarjeta desconocida solo se ofrece en el
// formulario de asignar carnet si se escaneó hace menos de esto — pasado ese
// tiempo se asume que ya no está frente al lector.
const VENTANA_TARJETA_DESCONOCIDA_MS = 2 * 60 * 1000;

@Injectable()
export class NfcService {
  constructor(
    @InjectRepository(LectorNfc) private readonly lectorRepository: Repository<LectorNfc>,
    @InjectRepository(TarjetaNfc) private readonly tarjetaRepository: Repository<TarjetaNfc>,
    @InjectRepository(Estudiante) private readonly estudianteRepository: Repository<Estudiante>,
    @InjectRepository(Profesor) private readonly profesorRepository: Repository<Profesor>,
    @InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>,
    @InjectRepository(TarjetaDesconocida) private readonly tarjetaDesconocidaRepository: Repository<TarjetaDesconocida>,
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
      nombre: dto.nombre.trim(),
      codigoLector: dto.codigoLector.trim(),
      descripcionUbicacion: dto.descripcionUbicacion?.trim() ?? null,
      descripcion: dto.descripcion?.trim() ?? null,
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

    const estadoActiva = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.TARJETA, codigo: 'activa' },
    });
    if (!estadoActiva) {
      throw new ConflictException('No existe el estado "activa" de tarjeta en la tabla estados (falta el seed).');
    }

    let estudiante: Estudiante | null = null;
    let profesor: Profesor | null = null;

    if (dto.tipoTitular === TipoTitular.ESTUDIANTE) {
      estudiante = await this.estudianteRepository.findOne({ where: { id: dto.estudianteId } });
      if (!estudiante) {
        throw new ConflictException('El estudiante indicado no existe.');
      }
      // Solo cuenta como "ya tiene tarjeta" una tarjeta ACTIVA — si la anterior
      // fue desactivada (ver cambiarTarjetaEstudiante), este estudiante debe
      // poder recibir una nueva por esta misma vía.
      const yaTiene = await this.tarjetaRepository.findOne({
        where: { estudianteId: estudiante.id, estadoId: estadoActiva.id },
      });
      if (yaTiene) {
        throw new ConflictException('Este estudiante ya tiene una tarjeta asignada.');
      }
    } else {
      profesor = await this.profesorRepository.findOne({ where: { id: dto.profesorId } });
      if (!profesor) {
        throw new ConflictException('El profesor indicado no existe.');
      }
      const yaTiene = await this.tarjetaRepository.findOne({
        where: { profesorId: profesor.id, estadoId: estadoActiva.id },
      });
      if (yaTiene) {
        throw new ConflictException('Este profesor ya tiene una tarjeta asignada.');
      }
    }

    const tarjeta = this.tarjetaRepository.create({
      uidTarjeta: dto.uidTarjeta.trim(),
      tipoTitular: dto.tipoTitular,
      estudiante,
      profesor,
      estado: estadoActiva,
    });

    const guardada = await this.tarjetaRepository.save(tarjeta);
    await this.marcarTarjetaDesconocidaResuelta(dto.uidTarjeta.trim());
    return guardada;
  }

  async cambiarTarjetaEstudiante(estudianteId: string, dto: CambiarTarjetaEstudianteDto) {
    const estudiante = await this.estudianteRepository.findOne({ where: { id: estudianteId } });
    if (!estudiante) {
      throw new ConflictException('El estudiante indicado no existe.');
    }

    const uidNuevo = dto.uidTarjeta.trim();
    const duplicada = await this.tarjetaRepository.findOne({ where: { uidTarjeta: uidNuevo } });
    if (duplicada) {
      throw new ConflictException('Ya existe una tarjeta con ese UID.');
    }

    const estadoActiva = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.TARJETA, codigo: 'activa' },
    });
    if (!estadoActiva) {
      throw new ConflictException('No existe el estado "activa" de tarjeta en la tabla estados (falta el seed).');
    }

    const estadoInactiva = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.TARJETA, codigo: 'inactiva' },
    });
    if (!estadoInactiva) {
      throw new ConflictException('No existe el estado "inactiva" de tarjeta en la tabla estados (falta el seed).');
    }

    // Se desactiva la tarjeta anterior (se conserva como historial) y se crea
    // una tarjeta nueva con el UID indicado, en vez de sobrescribir el UID
    // de la tarjeta existente.
    const tarjetaActual = await this.tarjetaRepository.findOne({
      where: { estudianteId: estudiante.id, tipoTitular: TipoTitular.ESTUDIANTE, estadoId: estadoActiva.id },
    });

    if (tarjetaActual) {
      tarjetaActual.estado = estadoInactiva;
      await this.tarjetaRepository.save(tarjetaActual);
    }

    const tarjetaNueva = this.tarjetaRepository.create({
      uidTarjeta: uidNuevo,
      tipoTitular: TipoTitular.ESTUDIANTE,
      estudiante,
      estado: estadoActiva,
    });

    const guardada = await this.tarjetaRepository.save(tarjetaNueva);
    await this.marcarTarjetaDesconocidaResuelta(uidNuevo);
    return guardada;
  }

  async listarTarjetas() {
    return this.tarjetaRepository.find({
      relations: ['estudiante', 'profesor', 'estado'],
      order: { fechaAsignacion: 'DESC' },
    });
  }

  // Última tarjeta escaneada por el lector que no corresponde a ningún
  // carnet asignado, dentro de la ventana de "recién escaneada" y que
  // todavía no se haya usado para asignar/cambiar un carnet. Pensado para
  // el formulario "Asignar carnet" de la pantalla Carnets: el frontend lo
  // consulta por refresco periódico (polling) mientras el formulario está
  // abierto, y ofrece usar ese UID en vez de que alguien tenga que
  // copiarlo a mano de la tarjeta física.
  async obtenerUltimaTarjetaDesconocida() {
    const desde = new Date(Date.now() - VENTANA_TARJETA_DESCONOCIDA_MS);
    const registro = await this.tarjetaDesconocidaRepository.findOne({
      where: { resuelta: false, fechaEscaneo: MoreThanOrEqual(desde) },
      order: { fechaEscaneo: 'DESC' },
      relations: ['lector'],
    });

    if (!registro) {
      return null;
    }

    return {
      uidTarjeta: registro.uidTarjeta,
      fechaEscaneo: registro.fechaEscaneo,
      lector: registro.lector
        ? { id: registro.lector.id, nombre: registro.lector.nombre, codigoLector: registro.lector.codigoLector }
        : null,
    };
  }

  private async marcarTarjetaDesconocidaResuelta(uidTarjeta: string): Promise<void> {
    await this.tarjetaDesconocidaRepository.update({ uidTarjeta, resuelta: false }, { resuelta: true });
  }
}