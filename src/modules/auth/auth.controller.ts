import { Body, Controller, Headers, HttpCode, HttpStatus, Ip, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LicenciaExenta } from '../licenciamiento/decorators/licencia-exenta.decorator';
import { AppConfig } from '../../config/configuration';

// Nombre de la cookie httpOnly que transporta el refresh token. El "path"
// con el que se acota (login/refresh/logout, para que el navegador no la
// reenvíe en cada petición a la API) viene de config (`cookies.authPath`,
// env COOKIE_AUTH_PATH) en vez de ser fijo aquí: por defecto es '/auth'
// (llamadas directas backend<->frontend, como en el VPS de pruebas actual),
// pero detrás de un reverse proxy que expone la API bajo un prefijo (p. ej.
// Nginx canalizando /api/* al backend, ver docker-compose de producción)
// el navegador solo ve rutas como /api/auth/refresh — con path='/auth' esa
// cookie nunca se reenviaría. Ahí hay que configurar COOKIE_AUTH_PATH=/api/auth.
const COOKIE_REFRESH_TOKEN = 'asistsca_refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  // Login/refresh/logout quedan exentos de LicenciaGuard a propósito: un
  // administrador siempre debe poder entrar y ver el aviso de licencia
  // (GET /licencia/estado), incluso con la licencia en degradación total.
  // Sin esta excepción, a los 15 minutos (expiración del access token) nadie
  // podría refrescar sesión y la app quedaría inutilizable hasta para leer.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @LicenciaExenta()
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...resto } = await this.authService.login(dto, { ip, userAgent });
    this.fijarCookieRefresh(res, refreshToken);
    return resto;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @LicenciaExenta()
  async refresh(
    @Req() req: Request,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshTokenRecibido = this.leerCookieRefresh(req);
    const { refreshToken, ...resto } = await this.authService.refrescar(refreshTokenRecibido, { ip, userAgent });
    this.fijarCookieRefresh(res, refreshToken);
    return resto;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @LicenciaExenta()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshTokenRecibido = this.leerCookieRefresh(req);
    res.clearCookie(COOKIE_REFRESH_TOKEN, { path: this.configService.get('cookies.authPath', { infer: true }) });
    if (!refreshTokenRecibido) {
      return { mensaje: 'Sesión cerrada' };
    }
    return this.authService.logout(refreshTokenRecibido);
  }

  /**
   * Sin esta cookie no hay sesión que renovar/cerrar — se trata igual que un
   * refresh token inválido (401 desde authService) en vez de reventar con un
   * error distinto, para que el frontend maneje un único caso de "sesión
   * vencida" tanto si la cookie nunca existió como si expiró.
   */
  private leerCookieRefresh(req: Request): string {
    return (req.cookies?.[COOKIE_REFRESH_TOKEN] as string | undefined) ?? '';
  }

  private fijarCookieRefresh(res: Response, refreshToken: string): void {
    res.cookie(COOKIE_REFRESH_TOKEN, refreshToken, {
      httpOnly: true,
      secure: this.configService.get('cookies.secure', { infer: true }),
      sameSite: this.configService.get('cookies.sameSite', { infer: true }),
      path: this.configService.get('cookies.authPath', { infer: true }),
      maxAge: this.configService.get('cookies.refreshMaxAgeMs', { infer: true }),
    });
  }
}
