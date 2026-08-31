import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Colegio } from './../../config/entities/colegio/colegio.entity';
import { CrearColegioDto } from './dto/crear-colegio.dto';

@Injectable()
export class ColegioService {
  constructor(
    @InjectRepository(Colegio)
    private readonly colegioRepository: Repository<Colegio>,
  ) {}

async crear(dto: CrearColegioDto) {
  const yaExiste = await this.colegioRepository.count();
  if (yaExiste > 0) {
    throw new ConflictException('Ya existe un colegio registrado.');
  }

  const colegio = this.colegioRepository.create({
    ...dto,
    anioLectivoActivo: dto.anioLectivoActivo ?? new Date().getFullYear(),
  });
  return this.colegioRepository.save(colegio);
}
}