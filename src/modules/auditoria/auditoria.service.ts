import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from '../../config/entities/auditoria/auditoria.entity';

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    @InjectRepository(Auditoria) private readonly auditoriaRepository: Repository<Auditoria>,
  ) {}

  async registrar(datos: {
    usuarioId: string | null;
    accion: string;
    entidad: string;
    entidadId: string | null;
    detalle?: Record<string, unknown> | null;
    ip?: string | null;
  }) {
    try {
      const registro = this.auditoriaRepository.create({
        usuarioId: datos.usuarioId,
        accion: datos.accion,
        entidad: datos.entidad,
        entidadId: datos.entidadId,
        detalle: datos.detalle ?? null,
        ip: datos.ip ?? null,
      });
      await this.auditoriaRepository.save(registro);
    } catch (error) {
      this.logger.error(`No se pudo registrar auditoría (${datos.accion}/${datos.entidad}): ${error}`);
    }
  }
}