import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Usuario } from '../../config/entities/usuarios/usuario.entity';
import { RefreshToken } from '../../config/entities/auth/refresh-token.entity';
import { TelegramApiModule } from '../../telegram_bot/telegram-api.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, RefreshToken]),
    JwtModule.register({ global: true }),// access y refresh usan secrets distintos, se pasan explícitos en cada sign()/verify() de AuthService
    // Para avisar por Telegram a la propia persona cuando su cuenta inicia
    // sesión (ver AuthService.login) — módulo sin dependencias, no genera ciclos.
    TelegramApiModule,
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}