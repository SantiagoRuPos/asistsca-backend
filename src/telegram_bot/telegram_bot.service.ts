import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Usuario } from '../config/entities/usuarios/usuario.entity';
import { AcademicoService } from '../modules/academico/academico.service';
import { AsistenciaService } from '../modules/asistencia/asistencia.service';
import { TelegramApiService } from './telegram-api.service';

// Telegram corta los mensajes por encima de 4096 caracteres (error 400 de su
// API) — se deja un margen prudente para no arriesgarse con colegios grandes.
const LIMITE_CARACTERES_MENSAJE = 3500;

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    @InjectRepository(Usuario) private readonly usuarioRepository: Repository<Usuario>,
    private readonly academicoService: AcademicoService,
    private readonly asistenciaService: AsistenciaService,
    private readonly telegramApiService: TelegramApiService,
  ) {}

  async procesarWebhook(body: any) {
    this.logger.log(`Webhook recibido: ${JSON.stringify(body)}`);

    // Un tap sobre un botón inline (por ejemplo, "Sí, reportar al
    // coordinador" del aviso de evadido) llega como callback_query, no
    // como message — se procesa aparte y nunca cae en el flujo normal de
    // texto/whitelist de abajo.
    if (body?.callback_query) {
      await this.procesarCallbackQuery(body.callback_query);
      return { ok: true };
    }

    const message = body?.message;

    if (!message) {
      return { ok: true };
    }

    const chatId = message.chat?.id;

    if (!chatId) {
      return { ok: true };
    }

    // Si el mensaje trae un contacto, es la respuesta al botón "Compartir mi
    // número" del flujo de verificación — tiene prioridad sobre cualquier
    // texto que pudiera venir junto (Telegram no manda texto en este caso).
    if (message.contact) {
      await this.procesarContacto(chatId, message);
      return { ok: true };
    }

    const texto = message.text?.trim().toLowerCase();

    if (!texto) {
      return { ok: true };
    }

    // Whitelist: solo profesores/administradores/rectores/coordinadores ya
    // registrados en la tabla usuarios (con su número de Telegram vinculado)
    // pueden conversar con el bot. Cualquier otro chat recibe el mensaje de
    // "no estás en la whitelist" y no llega a ver ningún dato del colegio.
    const usuario = await this.buscarUsuarioAutorizado(chatId);

    if (!usuario) {
      await this.solicitarVerificacion(chatId);
      return { ok: true };
    }

    await this.procesarMensaje(chatId, texto, usuario);

    return { ok: true };
  }

  // ---------- Whitelist / verificación de identidad ----------

  /**
   * Devuelve el Usuario ya vinculado a este chat de Telegram, o null si el
   * chat no está vinculado a ninguna cuenta, o si la cuenta vinculada ya no
   * está activa (por ejemplo, si alguien la desactivó desde Usuarios después
   * de que ese profesor verificó su Telegram — se revisa en cada mensaje, no
   * solo la primera vez).
   */
  private async buscarUsuarioAutorizado(chatId: number): Promise<Usuario | null> {
    const usuario = await this.usuarioRepository.findOne({
      where: { telegramChatId: String(chatId) },
      relations: ['estado', 'rol'],
    });

    if (!usuario || usuario.estado?.codigo !== 'activo') {
      return null;
    }

    return usuario;
  }

  /**
   * Procesa la respuesta al botón "Compartir mi número": busca en la tabla
   * usuarios un registro cuyo teléfono coincida (comparando solo dígitos,
   * para no fallar por espacios, guiones o el indicativo +57) y, si existe y
   * está activo, vincula este chat de Telegram a esa cuenta de forma
   * permanente — así la próxima vez ya no hace falta volver a compartir el
   * número.
   */
  private async procesarContacto(chatId: number, message: any) {
    const contacto = message.contact;
    const telefonoCompartido: string | undefined = contacto?.phone_number;

    if (!telefonoCompartido) {
      return;
    }

    // El teclado que se envía en solicitarVerificacion() usa
    // request_contact, que en Telegram solo permite compartir el contacto
    // propio — esta comprobación es una segunda capa de seguridad por si
    // llegara un contacto de otra forma (por ejemplo, reenviado a mano).
    const quienEscribe = message.from?.id;
    if (contacto.user_id && quienEscribe && contacto.user_id !== quienEscribe) {
      await this.enviarMensaje(chatId, '⚠️ Debes compartir tu propio número de contacto, no el de otra persona.');
      return;
    }

    const telefonoNormalizado = this.normalizarTelefono(telefonoCompartido);

    const candidatos = await this.usuarioRepository.find({
      where: { telefono: Not(IsNull()) },
      relations: ['estado', 'rol'],
    });

    const usuario = candidatos.find(
      (candidato) => candidato.telefono && this.normalizarTelefono(candidato.telefono) === telefonoNormalizado,
    );

    if (!usuario) {
      await this.enviarMensaje(chatId, this.mensajeNoAutorizado(), { remove_keyboard: true });
      return;
    }

    if (usuario.estado?.codigo !== 'activo') {
      await this.enviarMensaje(
        chatId,
        '🚫 Encontré tu número, pero tu cuenta en AsistSCA está inactiva. Contacta al administrador del colegio.',
        { remove_keyboard: true },
      );
      return;
    }

    usuario.telegramChatId = String(chatId);
    await this.usuarioRepository.save(usuario);

    this.logger.log(`Chat de Telegram ${chatId} vinculado al usuario ${usuario.id} (${usuario.email})`);

    const mensaje = `
✅ ¡Listo, ${usuario.nombreCompleto}! Verifiqué tu número y quedaste registrado como ${usuario.rol?.nombre ?? 'usuario'} de AsistSCA.

${this.textoMenuAyuda()}
    `.trim();

    await this.enviarMensaje(chatId, mensaje, { remove_keyboard: true });
  }

  /**
   * Reduce un número de teléfono a solo dígitos y se queda con los últimos
   * 10 (largo de un celular colombiano) — así "300 123 4567", "3001234567" y
   * "+57 300 123 4567" se comparan como el mismo número sin importar cómo se
   * haya guardado en la tabla usuarios ni el formato que use el teléfono de
   * quien escribe en Telegram.
   */
  private normalizarTelefono(telefono: string): string {
    const soloDigitos = telefono.replace(/\D/g, '');
    return soloDigitos.slice(-10);
  }

  private mensajeNoAutorizado(): string {
    return `
🚫 No estás en la whitelist.

Tu número no está registrado como profesor, rector, coordinador o administrador en AsistSCA. Si crees que es un error, pide a un administrador del colegio que verifique tu número en la pantalla de Usuarios.
    `.trim();
  }

  private async solicitarVerificacion(chatId: number) {
    const mensaje = `
🔒 Antes de continuar necesito verificar que estás autorizado para usar este bot.

Comparte tu número de teléfono con el botón de abajo (debe ser el mismo que está registrado en AsistSCA).
    `.trim();

    await this.enviarMensaje(chatId, mensaje, {
      keyboard: [[{ text: '📱 Compartir mi número', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    });
  }

  // ---------- Botones inline (callback_query) ----------

  /**
   * Procesa el botón "Sí, reportar al coordinador" del aviso de evadido
   * que le llega al director de grupo (ver AsistenciaService.notificarEvadido
   * / escalarEvadidoACoordinador). Nunca confía en el chatId por sí solo:
   * primero exige que el chat esté en la whitelist (igual que cualquier
   * mensaje de texto) y luego AsistenciaService vuelve a validar, del
   * lado del servidor, que ese usuario es realmente el director de grupo
   * del curso del estudiante — este método solo interpreta la respuesta y
   * decide qué mostrarle a quien presionó el botón.
   */
  private async procesarCallbackQuery(callbackQuery: any) {
    const callbackId = callbackQuery.id;
    const chatId = callbackQuery.message?.chat?.id;
    const messageId = callbackQuery.message?.message_id;
    const data: string | undefined = callbackQuery.data;

    if (!callbackId) {
      return;
    }

    if (!chatId || !data) {
      await this.telegramApiService.responderCallback(callbackId);
      return;
    }

    const usuario = await this.buscarUsuarioAutorizado(chatId);
    if (!usuario) {
      await this.telegramApiService.responderCallback(callbackId, '🚫 No autorizado.', true);
      return;
    }

    const [accion, asistenciaDiariaId] = data.split(':');

    if (accion !== 'evadido_escalar' || !asistenciaDiariaId) {
      await this.telegramApiService.responderCallback(callbackId);
      return;
    }

    const resultado = await this.asistenciaService.escalarEvadidoACoordinador(asistenciaDiariaId, usuario.id);

    if (resultado.razon === 'no_autorizado') {
      await this.telegramApiService.responderCallback(
        callbackId,
        '🚫 Solo el director de grupo de ese curso puede reportarlo.',
        true,
      );
      return;
    }

    if (resultado.razon === 'ya_escalado') {
      await this.telegramApiService.responderCallback(callbackId, 'Ya se le había avisado al coordinador. ✅');
      if (messageId) {
        await this.telegramApiService.quitarBotones(chatId, messageId);
      }
      return;
    }

    if (resultado.razon === 'no_aplica') {
      await this.telegramApiService.responderCallback(
        callbackId,
        'Este caso ya no aplica (pudo haber cambiado de estado).',
        true,
      );
      return;
    }

    await this.telegramApiService.responderCallback(callbackId, '✅ Coordinador notificado.');
    if (messageId) {
      await this.telegramApiService.quitarBotones(chatId, messageId);
    }
  }

  // ---------- Comandos ----------

  private async procesarMensaje(chatId: number, texto: string, usuario: Usuario) {
    switch (texto) {
      case 'hola':
      case '/start':
        await this.enviarSaludo(chatId, usuario);
        break;

      case 'estudiantes':
      case '/estudiantes':
        await this.enviarResumenEstudiantes(chatId);
        break;

      case 'evadidos':
      case '/evadidos':
        await this.enviarListaEvadidos(chatId);
        break;

      default:
        await this.enviarMensajeNoReconocido(chatId);
        break;
    }
  }

  private textoMenuAyuda(): string {
    return `
💬 Puedes escribirme:

• Estudiantes → total de estudiantes del colegio, ausentes y evadidos de hoy.
• Evadidos → la lista de quiénes están marcados como evadidos hoy.
    `.trim();
  }

  private async enviarSaludo(chatId: number, usuario: Usuario) {
    const mensaje = `
👋 ¡Hola, ${usuario.nombreCompleto}! Soy AsistBot, tu asistente de AsistSCA.

${this.textoMenuAyuda()}
    `.trim();

    await this.enviarMensaje(chatId, mensaje);
  }

  private async enviarMensajeNoReconocido(chatId: number) {
    const mensaje = `
🤔 No entendí tu mensaje.

${this.textoMenuAyuda()}
    `.trim();

    await this.enviarMensaje(chatId, mensaje);
  }

  private async enviarResumenEstudiantes(chatId: number) {
    const [resumenEstudiantes, resumenDiario, evadidos] = await Promise.all([
      this.academicoService.obtenerResumenEstudiantes(),
      this.asistenciaService.obtenerResumenDiario(),
      this.asistenciaService.obtenerEvadidosHoy(),
    ]);

    const mensaje = `
📊 Estudiantes — AsistSCA

Total en el colegio: ${resumenEstudiantes.totalEstudiantes} (${resumenEstudiantes.activos.valor} activos, ${resumenEstudiantes.inactivos.valor} inactivos)

Hoy (${resumenDiario.fecha}):
🔴 Ausentes: ${resumenDiario.ausencias.valor} (${resumenDiario.ausencias.porcentaje}% de los matriculados)
🚪 Evadidos: ${evadidos.valor} (${evadidos.porcentaje}% de los matriculados)

Escribe "evadidos" para ver quiénes son.
    `.trim();

    await this.enviarMensaje(chatId, mensaje);
  }

  private async enviarListaEvadidos(chatId: number) {
    const evadidos = await this.asistenciaService.obtenerEvadidosHoy();

    if (evadidos.valor === 0) {
      await this.enviarMensaje(chatId, `✅ Nadie está marcado como evadido hoy (${evadidos.fecha}).`);
      return;
    }

    let lineas = evadidos.estudiantes
      .map((estudiante) => `• ${estudiante.nombres} ${estudiante.apellidos}${estudiante.curso ? ` (${estudiante.curso})` : ''}`)
      .join('\n');

    let notaRecorte = '';
    if (lineas.length > LIMITE_CARACTERES_MENSAJE) {
      lineas = lineas.slice(0, LIMITE_CARACTERES_MENSAJE);
      lineas = lineas.slice(0, lineas.lastIndexOf('\n'));
      const mostrados = lineas.split('\n').length;
      notaRecorte = `\n\n… y ${evadidos.valor - mostrados} más (la lista es muy larga para un solo mensaje).`;
    }

    const mensaje = `
🚪 Evadidos hoy (${evadidos.fecha}) — ${evadidos.valor}

${lineas}${notaRecorte}
    `.trim();

    await this.enviarMensaje(chatId, mensaje);
  }

  // ---------- Envío de mensajes ----------

  private async enviarMensaje(chatId: number, mensaje: string, replyMarkup?: Record<string, unknown>) {
    return this.telegramApiService.enviarMensaje(chatId, mensaje, replyMarkup);
  }
}
