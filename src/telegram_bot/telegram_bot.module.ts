import { Module } from '@nestjs/common';
import { TelegramBotController } from './telegram_bot.controller';
import { TelegramBotService } from './telegram_bot.service';

@Module({
  controllers: [TelegramBotController],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}