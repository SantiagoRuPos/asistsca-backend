import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Envoltorio delgado sobre la API HTTP de Telegram (sendMessage), sin
 * ninguna dependencia de otros módulos de negocio (Academico, Asistencia,
 * etc.) — a propósito, para que tanto TelegramBotModule (conversación con
 * el bot) como AsistenciaModule (notificaciones automáticas de "evadido")
 * puedan importarlo sin crear una dependencia circular entre ellos.
 *
 * TELEGRAM_BOT_TOKEN es opcional (ver DEPLOYMENT.md): si no está
 * configurado, el servicio no debe tumbar el arranque de toda la
 * aplicación -- simplemente queda inactivo y cada método se vuelve un
 * no-op con una advertencia en el log, igual que ya se hace con SMTP.
 */
@Injectable()
export class TelegramApiService {
  private readonly logger = new Logger(TelegramApiService.name);
  private readonly baseUrl: string | null;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN no está configurado -- el bot de Telegram y las notificaciones (alertas de login, escalamiento de evadidos) quedan inactivos.',
      );
      this.baseUrl = null;
      return;
    }

    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async enviarMensaje(chatId: number | string, mensaje: string, replyMarkup?: Record<string, unknown>) {
    if (!this.baseUrl) {
      this.logger.warn(`Telegram no configurado -- no se envió el mensaje al chat ${chatId}`);
      return;
    }

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

  /**
   * Responde a un tap sobre un botón inline (answerCallbackQuery) — hace
   * que Telegram deje de mostrar el reloj de "cargando" sobre el botón.
   * `texto` es opcional y aparece como un toast pequeño (o una alerta
   * bloqueante si `mostrarAlerta` es true); Telegram exige responder a
   * todo callback_query en un plazo corto, así que esto nunca lanza el
   * error hacia arriba — un fallo aquí no debe tumbar el procesamiento
   * del webhook.
   */
  async responderCallback(callbackQueryId: string, texto?: string, mostrarAlerta = false) {
    if (!this.baseUrl) {
      return;
    }

    try {
      await axios.post(`${this.baseUrl}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        ...(texto ? { text: texto } : {}),
        show_alert: mostrarAlerta,
      });
    } catch (error) {
      this.logger.error(`Error respondiendo al callback ${callbackQueryId}`, error);
    }
  }

  /**
   * Quita el teclado inline de un mensaje ya enviado (por ejemplo, el
   * botón "Sí, reportar al coordinador" una vez que ya se usó), para que
   * no se pueda volver a presionar por accidente. Best-effort: si falla,
   * el botón se queda visible pero el registro ya quedó marcado como
   * escalado en la base de datos, así que un segundo intento no duplica
   * la notificación al coordinador.
   */
  async quitarBotones(chatId: number | string, messageId: number) {
    if (!this.baseUrl) {
      return;
    }

    try {
      await axios.post(`${this.baseUrl}/editMessageReplyMarkup`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      });
    } catch (error) {
      this.logger.error(`Error quitando los botones del mensaje ${messageId} en el chat ${chatId}`, error);
    }
  }
}
