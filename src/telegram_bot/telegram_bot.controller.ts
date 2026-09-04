import { Body, Controller, Post } from '@nestjs/common';
import { TelegramBotService } from './telegram_bot.service';

@Controller('telegram')
export class TelegramBotController {
  constructor(
    private readonly telegramBotService: TelegramBotService,
  ) {}

  @Post('webhook')
  async webhook(@Body() body: any) {
    return this.telegramBotService.procesarWebhook(body);
  }
}