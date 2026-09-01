import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriaEstado, Estado } from '../../config/entities/catalogos/estado.entity';

@Injectable()
export class CatalogosService {
  constructor(@InjectRepository(Estado) private readonly estadoRepository: Repository<Estado>) {}

  listarEstados(categoria?: CategoriaEstado) {
    return this.estadoRepository.find({
      where: categoria ? { categoria } : {},
      order: { nombre: 'ASC' },
    });
  }
}
