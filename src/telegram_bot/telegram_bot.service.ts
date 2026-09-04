import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN no está configurado');
    }

    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async enviarMensaje(chatId: number, mensaje: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: mensaje,
      });

      this.logger.log(`Mensaje enviado al chat ${chatId}`);
    } catch (error) {
      this.logger.error('Error enviando mensaje a Telegram', error);
      throw error;
    }
  }
}