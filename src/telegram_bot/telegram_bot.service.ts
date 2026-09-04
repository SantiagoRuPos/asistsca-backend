import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const token =
      this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!token) {
      throw new Error(
        'TELEGRAM_BOT_TOKEN no está configurado',
      );
    }

    this.baseUrl =
      `https://api.telegram.org/bot${token}`;
  }

  async procesarWebhook(body: any) {
    this.logger.log(
      `Webhook recibido: ${JSON.stringify(body)}`,
    );

    const message = body?.message;

    if (!message) {
      return { ok: true };
    }

    const chatId = message.chat?.id;
    const texto = message.text
      ?.trim()
      .toLowerCase();

    if (!chatId || !texto) {
      return { ok: true };
    }

    await this.procesarMensaje(chatId, texto);

    return { ok: true };
  }

  private async procesarMensaje(
    chatId: number,
    texto: string,
  ) {
    switch (texto) {
      case 'hola':
      case '/start':
        await this.enviarSaludo(chatId);
        break;

      default:
        await this.enviarMensajeNoReconocido(chatId);
        break;
    }
  }

  private async enviarSaludo(chatId: number) {
    const mensaje = `
👋 ¡Hola! Soy AsistBot, tu asistente de AsistSCA.

Estoy aquí para ayudarte a consultar información y mantenerte al tanto de las novedades de tus estudiantes.

Puedes preguntarme sobre asistencia, llegadas, ausencias y otras novedades.

💬 Cuéntame, ¿en qué puedo ayudarte?
    `.trim();

    await this.enviarMensaje(
      chatId,
      mensaje,
    );
  }

  private async enviarMensajeNoReconocido(
    chatId: number,
  ) {
    const mensaje = `
🤔 No entendí tu mensaje.

Por ahora puedes escribir:

• Hola
• /start
    `.trim();

    await this.enviarMensaje(
      chatId,
      mensaje,
    );
  }

  private async enviarMensaje(
    chatId: number,
    mensaje: string,
  ) {
    try {
      await axios.post(
        `${this.baseUrl}/sendMessage`,
        {
          chat_id: chatId,
          text: mensaje,
        },
      );

      this.logger.log(
        `Mensaje enviado al chat ${chatId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error enviando mensaje al chat ${chatId}`,
        error,
      );

      throw error;
    }
  }
}