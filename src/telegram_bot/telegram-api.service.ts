import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Envoltorio delgado sobre la API HTTP de Telegram (sendMessage), sin
 * ninguna dependencia de otros módulos de negocio (Academico, Asistencia,
 * etc.) — a propósito, para que tanto TelegramBotModule (conversación con
 * el bot) como AsistenciaModule (notificaciones automáticas de "evadido")
 * puedan importarlo sin crear una dependencia circular entre ellos.
 */
@Injectable()
export class TelegramApiService {
  private readonly logger = new Logger(TelegramApiService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN no está configurado');
    }

    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async enviarMensaje(chatId: number | string, mensaje: string, replyMarkup?: Record<string, unknown>) {
    try {
      await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: mensaje,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      });

      this.logger.log(`Mensaje enviado al chat ${chatId}`);
    } catch (error) {
      this.logger.error(`Error enviando mensaje al chat ${chatId}`, error);

      throw error;
    }
  }
}
