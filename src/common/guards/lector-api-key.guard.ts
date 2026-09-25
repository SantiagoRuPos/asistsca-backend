import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { LectorNfc } from '../../config/entities/nfc/lector-nfc.entity';

@Injectable()
export class LectorApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(LectorNfc) private readonly lectorRepository: Repository<LectorNfc>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta la API key del lector');
    }

    const apiKeyHash = createHash('sha256').update(authHeader.slice('Bearer '.length)).digest('hex');
    // (2026-09-25) Se necesita 'estado' cargado para el chequeo de abajo --
    // antes este guard nunca miraba si el lector estaba activo, así que un
    // lector marcado como inactivo/deshabilitado seguía autenticándose con
    // éxito mientras su API key existiera en la base de datos.
    const lector = await this.lectorRepository.findOne({ where: { apiKeyHash }, relations: ['estado'] });

    if (!lector) {
      throw new UnauthorizedException('API key de lector inválida');
    }

    if (lector.estado?.codigo !== 'activo') {
      throw new ForbiddenException('Este lector está inactivo o deshabilitado.');
    }

    // No se espera esta actualización para no añadir latencia al flujo de ingesta NFC en tiempo real.
    void this.lectorRepository.update(lector.id, { ultimaConexion: new Date() });

    request.lector = lector;
    return true;
  }
}