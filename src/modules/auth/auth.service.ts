import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { Usuario } from '../../config/entities/usuarios/usuario.entity';
import { RefreshToken } from '../../config/entities/auth/refresh-token.entity';
import { AppConfig } from '../../config/configuration';
import { LoginDto } from './dto/login.dto';

interface ContextoRequest {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async login(dto: LoginDto, contexto: ContextoRequest) {
    const email = dto.email.toLowerCase().trim();
const usuario = await this.usuarioRepository.findOne({ where: { email }, relations: ['rol'] });
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta.getTime() > Date.now()) {
      throw new ForbiddenException(
        `Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta de nuevo después de ${usuario.bloqueadoHasta.toLocaleString('es-CO')}.`,
      );
    }

    const passwordValida = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!passwordValida) {
      await this.registrarIntentoFallido(usuario);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    usuario.intentosFallidosLogin = 0;
    usuario.bloqueadoHasta = null;
    usuario.ultimoLogin = new Date();
    await this.usuarioRepository.save(usuario);

    const { refreshTokenId, ...tokens } = await this.emitirTokens(usuario, contexto);
    return tokens;
  }

  async refrescar(refreshTokenRecibido: string, contexto: ContextoRequest) {
    let payload: { sub: string; jti: string };
    try {
      payload = this.jwtService.verify(refreshTokenRecibido, {
        secret: this.configService.get('jwt.refreshSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const tokenHash = this.hashToken(refreshTokenRecibido);
    const tokenGuardado = await this.refreshTokenRepository.findOne({ where: { tokenHash } });

    if (!tokenGuardado || tokenGuardado.revocado || tokenGuardado.fechaExpiracion.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const usuario = await this.usuarioRepository.findOne({ where: { id: payload.sub } });
    if (!usuario) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    tokenGuardado.revocado = true;

    const nuevos = await this.emitirTokens(usuario, contexto);
    tokenGuardado.reemplazadoPorTokenId = nuevos.refreshTokenId;
    await this.refreshTokenRepository.save(tokenGuardado);

    const { refreshTokenId, ...tokens } = nuevos;
    return tokens;
  }

  async logout(refreshTokenRecibido: string) {
    const tokenHash = this.hashToken(refreshTokenRecibido);
    await this.refreshTokenRepository.update({ tokenHash }, { revocado: true });
    return { mensaje: 'Sesión cerrada' };
  }

  private async registrarIntentoFallido(usuario: Usuario) {
    const maxIntentos = this.configService.get('security.accountLockMaxAttempts', { infer: true });
    const minutosBloqueo = this.configService.get('security.accountLockMinutes', { infer: true });

    usuario.intentosFallidosLogin += 1;

    if (usuario.intentosFallidosLogin >= maxIntentos) {
      usuario.bloqueadoHasta = new Date(Date.now() + minutosBloqueo * 60 * 1000);
      usuario.intentosFallidosLogin = 0;
    }

    await this.usuarioRepository.save(usuario);
  }

private async emitirTokens(usuario: Usuario, contexto: ContextoRequest) {
const payload = { sub: usuario.id, email: usuario.email, rol: usuario.rol.nombre };
  const accessToken = this.jwtService.sign(payload, {
    secret: this.configService.get('jwt.accessSecret', { infer: true }),
    expiresIn: this.configService.get('jwt.accessExpiresIn', { infer: true }) as any,
  });

  const refreshExpiresIn = this.configService.get('jwt.refreshExpiresIn', { infer: true });
  const refreshToken = this.jwtService.sign(
    { sub: usuario.id, jti: randomUUID() },
    {
      secret: this.configService.get('jwt.refreshSecret', { infer: true }),
      expiresIn: refreshExpiresIn as any,
    },
  );

  const registro = this.refreshTokenRepository.create({
    usuarioId: usuario.id,
    tokenHash: this.hashToken(refreshToken),
    fechaExpiracion: new Date(Date.now() + this.parsearDuracionMs(refreshExpiresIn)),
  });
  const guardado = await this.refreshTokenRepository.save(registro);

  return { accessToken, refreshToken, refreshTokenId: guardado.id };
}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parsearDuracionMs(duracion: string): number {
    const match = /^(\d+)([smhd])$/.exec(duracion);
    if (!match) throw new Error(`Formato de duración inválido: ${duracion}`);
    const multiplicadores: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return parseInt(match[1], 10) * multiplicadores[match[2]];
  }
}