import { Body, Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramBotService } from './telegram_bot.service';

@Controller('telegram')
export class TelegramBotController {
  constructor(
    private readonly telegramBotService: TelegramBotService,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  async webhook(@Body() body: any, @Headers('x-telegram-bot-api-secret-token') secretoRecibido?: string) {
    // Opcional y retrocompatible: si se configura TELEGRAM_WEBHOOK_SECRET en
    // el .env (y se registra ese mismo valor como secret_token al llamar a
    // setWebhook de la API de Telegram), este endpoint público solo acepta
    // peticiones que traigan ese secreto en el header, para que no cualquiera
    // pueda simular un mensaje de Telegram y, por ejemplo, forzar consultas o
    // vincular un chatId a mano. Si no se configura, el endpoint se comporta
    // exactamente igual que antes (sin este chequeo).
    const secretoEsperado = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');

    if (secretoEsperado && secretoRecibido !== secretoEsperado) {
      throw new ForbiddenException('Token de webhook inválido.');
    }

    return this.telegramBotService.procesarWebhook(body);
  }
}
