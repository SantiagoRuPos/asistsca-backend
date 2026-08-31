import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
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
    const lector = await this.lectorRepository.findOne({ where: { apiKeyHash } });

    if (!lector) {
      throw new UnauthorizedException('API key de lector inválida');
    }

    request.lector = lector;
    return true;
  }
}