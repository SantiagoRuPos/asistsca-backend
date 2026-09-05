import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
import { TelegramApiService } from '../../telegram_bot/telegram-api.service';

interface ContextoRequest {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Usuario) private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly telegramApiService: TelegramApiService,
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

    // Alerta de seguridad por Telegram: se le avisa a la propia persona (no a
    // un administrador) cada vez que su cuenta inicia sesión, para que pueda
    // detectar un acceso que no reconoce (contraseña filtrada, etc.) y
    // reaccionar de inmediato. Solo en login real con contraseña — no en cada
    // refresh silencioso del access token (eso pasa cada 15 minutos mientras
    // el navegador siga abierto y sería puro ruido). Mejor esfuerzo: si
    // Telegram falla o la persona no tiene su cuenta vinculada, el login
    // nunca se ve afectado.
    this.notificarInicioSesion(usuario, contexto).catch((error) => {
      this.logger.error(`No se pudo notificar por Telegram el inicio de sesión de ${usuario.email}`, error);
    });

    return tokens;
  }

  /**
   * Best-effort: manda un aviso de "se inició sesión en tu cuenta" al chat de
   * Telegram ya vinculado del propio usuario (ver TelegramBotService — el
   * vínculo se crea cuando la persona verifica su número con el bot). Si no
   * tiene Telegram vinculado todavía, no se envía nada.
   */
  private async notificarInicioSesion(usuario: Usuario, contexto: ContextoRequest): Promise<void> {
    if (!usuario.telegramChatId) {
      return;
    }

    const fechaTexto = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date());

    const dispositivo = contexto.userAgent ? contexto.userAgent.slice(0, 120) : 'desconocido';
    const ip = contexto.ip ?? 'desconocida';

    const mensaje = `
🔐 Se inició sesión en tu cuenta de AsistSCA

Fecha: ${fechaTexto} (hora Colombia)
IP: ${ip}
Dispositivo: ${dispositivo}

Si no fuiste tú, cambia tu contraseña de inmediato desde "Mi perfil" y avisa a un administrador.
    `.trim();

    await this.telegramApiService.enviarMensaje(usuario.telegramChatId, mensaje);
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

    // OJO: se necesita la relación 'rol' aquí porque emitirTokens() lee usuario.rol.nombre
    // para armar el payload del access token. Sin `relations: ['rol']`, usuario.rol queda
    // undefined y emitirTokens() explota con "Cannot read properties of undefined (reading 'nombre')"
    // -- esto pasaba cada vez que el access token expiraba (cada 15 min) y el frontend
    // intentaba renovarlo en silencio, cerrando la sesión aunque el refresh token fuera válido.
    const usuario = await this.usuarioRepository.findOne({ where: { id: payload.sub }, relations: ['rol'] });
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
const payload = {
  sub: usuario.id,
  email: usuario.email,
  rol: usuario.rol.nombre,
  nombreCompleto: usuario.nombreCompleto,
  // El frontend usa esto para forzar la redirección a "Mi perfil" hasta que
  // la persona cambie su contraseña temporal (ver PerfilComponent y el guard
  // forzarCambioPasswordGuard) — viaja en el access token igual que el rol,
  // así que queda al día en cuanto se emite un token nuevo (login o refresh).
  debeCambiarPassword: usuario.debeCambiarPassword,
};
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