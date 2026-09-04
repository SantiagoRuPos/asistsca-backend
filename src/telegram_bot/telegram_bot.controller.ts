import { Body, Controller, Post } from '@nestjs/common';
import { TelegramBotService } from './telegram_bot.service';

@Controller('telegram')
export class TelegramBotController {
  constructor(
    private readonly telegramBotService: TelegramBotService,
  ) {}

  @Post('webhook')
  async webhook(@Body() body: any) {
    console.log('📩 Telegram:', JSON.stringify(body, null, 2));

    const message = body?.message;

    if (!message) {
      return { ok: true };
    }

    const chatId = message.chat?.id;
    const texto = message.text?.trim().toLowerCase();

    if (!chatId) {
      return { ok: true };
    }

    if (texto === 'hola') {
      await this.telegramBotService.enviarMensaje(
        chatId,
        'Hola 👋 Soy AsistSCA',
      );
    }

    return { ok: true };
  }
}