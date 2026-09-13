import { Body, Controller, Headers, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LicenciaExenta } from '../licenciamiento/decorators/licencia-exenta.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Login/refresh/logout quedan exentos de LicenciaGuard a propósito: un
  // administrador siempre debe poder entrar y ver el aviso de licencia
  // (GET /licencia/estado), incluso con la licencia en degradación total.
  // Sin esta excepción, a los 15 minutos (expiración del access token) nadie
  // podría refrescar sesión y la app quedaría inutilizable hasta para leer.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @LicenciaExenta()
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    return this.authService.login(dto, { ip, userAgent });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @LicenciaExenta()
  refresh(@Body() dto: RefreshTokenDto, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    return this.authService.refrescar(dto.refreshToken, { ip, userAgent });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @LicenciaExenta()
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }
}