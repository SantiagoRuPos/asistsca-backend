import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventoAsistencia, TipoEvento } from '../../config/entities/nfc/evento-asistencia.entity';
import { TarjetaNfc } from '../../config/entities/nfc/tarjeta-nfc.entity';
import { LectorNfc } from '../../config/entities/nfc/lector-nfc.entity';
import { RegistrarEventoDto } from './dto/registrar-evento.dto';

@Injectable()
export class AsistenciaService {
  constructor(
    @InjectRepository(EventoAsistencia) private readonly eventoRepository: Repository<EventoAsistencia>,
    @InjectRepository(TarjetaNfc) private readonly tarjetaRepository: Repository<TarjetaNfc>,
  ) {}

  async registrarEvento(dto: RegistrarEventoDto, lector: LectorNfc) {
    const tarjeta = await this.tarjetaRepository.findOne({ where: { uidTarjeta: dto.id_tarjeta } });
    if (!tarjeta) {
      throw new NotFoundException('Tarjeta no reconocida.');
    }

    if (lector.codigoLector !== dto.id_lector) {
      throw new NotFoundException('El id_lector no coincide con la api key usada.');
    }

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
      timestampEvento: new Date(),
    });
    const guardado = await this.eventoRepository.save(evento);

    return { evento: guardado.id, tipoEvento: guardado.tipoEvento, timestamp: guardado.timestampEvento };
  }
}