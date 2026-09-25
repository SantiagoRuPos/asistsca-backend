import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificacionWhatsapp } from '../../config/entities/comunicaciones/notificacion-whatsapp.entity';
import { EstudianteAcudiente } from '../../config/entities/academico/estudiante-acudiente.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { EventoAsistencia, TipoEvento } from '../../config/entities/nfc/evento-asistencia.entity';
import { WhatsappConfigService } from './whatsapp-config.service';
import { Colegio } from '../../config/entities/colegio/colegio.entity';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectRepository(NotificacionWhatsapp)
    private readonly notificacionRepository: Repository<NotificacionWhatsapp>,
    @InjectRepository(EstudianteAcudiente)
    private readonly estudianteAcudienteRepository: Repository<EstudianteAcudiente>,
    @InjectRepository(Estado)
    private readonly estadoRepository: Repository<Estado>,
    @InjectRepository(Colegio)
    private readonly colegioRepository: Repository<Colegio>,
    private readonly whatsappConfigService: WhatsappConfigService,
  ) {}

  async notificarEvento(estudianteId: string, evento: EventoAsistencia) {
    try {
      const configuracion = await this.whatsappConfigService.obtenerParaEnvio();
      if (!configuracion) {
        this.logger.warn('No hay configuración de WhatsApp registrada; se omite la notificación.');
        return;
      }

      const contactos = await this.estudianteAcudienteRepository.find({
        where: { estudianteId, esContactoNotificacion: true },
        relations: ['acudiente', 'estudiante'],
      });
      if (contactos.length === 0) return;

      // Plantillas de Meta actualizadas (2026-09-07): ambas (entrada y salida)
      // ahora piden 5 variables en el mismo orden — {{1}} acudiente,
      // {{2}} estudiante, {{3}} colegio, {{4}} fecha, {{5}} hora — el texto
      // fijo ("...su entrada a..."/"...su salida de...") ya está en la
      // plantilla aprobada en Meta, aquí solo se arma el arreglo de valores.
      const colegio = await this.colegioRepository.find({ take: 1 });
      const nombreColegio = colegio[0]?.nombre ?? 'AsistSCA';

      const tipoMensaje = evento.tipoEvento === TipoEvento.ENTRADA ? 'entrada' : 'salida';
      const nombrePlantilla =
        evento.tipoEvento === TipoEvento.ENTRADA ? configuracion.plantillaEntrada : configuracion.plantillaSalida;
      // Cada plantilla puede quedar aprobada en Meta con su propio idioma
      // (ver ConfiguracionWhatsapp.idiomaPlantillaEntrada/idiomaPlantillaSalida) —
      // ya no se asume que las dos comparten el mismo.
      const idiomaPlantilla =
        evento.tipoEvento === TipoEvento.ENTRADA ? configuracion.idiomaPlantillaEntrada : configuracion.idiomaPlantillaSalida;
      const fecha = evento.timestampEvento.toLocaleDateString('es-CO', {
        timeZone: 'America/Bogota',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const hora = evento.timestampEvento.toLocaleTimeString('es-CO', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
      });

      // (2026-09-25) Antes se mandaba a cada acudiente uno por uno con
      // await dentro del for — si un estudiante tenía dos contactos
      // marcados (ej. mamá y papá), el segundo mensaje esperaba a que el
      // primero terminara contra la API de Meta antes de siquiera empezar.
      // Como esto ya corre en segundo plano (void notificarEvento, no
      // bloquea la respuesta al ESP32), no hay ninguna razón para no
      // lanzarlos todos al mismo tiempo.
      await Promise.all(
        contactos.map((contacto) => {
          const nombreAcudiente = `${contacto.acudiente.nombres} ${contacto.acudiente.apellidos}`;
          const nombreEstudiante = `${contacto.estudiante.nombres} ${contacto.estudiante.apellidos}`;

          return this.enviarYRegistrar({
            estudianteId,
            acudienteId: contacto.acudienteId,
            telefono: contacto.acudiente.telefonoWhatsapp,
            tipoMensaje,
            nombrePlantilla,
            idioma: idiomaPlantilla,
            parametros: [nombreAcudiente, nombreEstudiante, nombreColegio, fecha, hora],
            configuracion,
            origenEventoId: evento.id,
          });
        }),
      );
    } catch (error) {
      this.logger.error(`No se pudo notificar el evento ${evento.id} por WhatsApp: ${error}`);
    }
  }

  private async enviarYRegistrar(opciones: {
    estudianteId: string;
    acudienteId: string;
    telefono: string;
    tipoMensaje: string;
    nombrePlantilla: string;
    idioma: string;
    parametros: string[];
    configuracion: { phoneNumberId: string; accessToken: string; apiVersion: string };
    origenEventoId: string;
  }) {
    const { telefono, nombrePlantilla, idioma, parametros, configuracion } = opciones;
    let whatsappMessageId: string | null = null;
    let codigoEstado = 'fallido';

    // (2026-09-25) Timeout explícito: el fetch nativo de Node no tiene uno
    // por defecto, así que si Meta (o la red de salida del servidor) se
    // cuelga, este envío podía quedar colgado mucho más de lo razonable
    // en vez de fallar rápido y quedar registrado como "fallido".
    const TIEMPO_LIMITE_ENVIO_MS = 10_000;
    const controladorTiempoLimite = new AbortController();
    const temporizador = setTimeout(() => controladorTiempoLimite.abort(), TIEMPO_LIMITE_ENVIO_MS);
    const inicioEnvio = Date.now();

    try {
      const respuesta = await fetch(
        `https://graph.facebook.com/${configuracion.apiVersion}/${configuracion.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${configuracion.accessToken}`,
            'Content-Type': 'application/json',
          },
          signal: controladorTiempoLimite.signal,
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: telefono,
            type: 'template',
            template: {
              name: nombrePlantilla,
              language: { code: idioma },
              ...(nombrePlantilla !== 'hello_world' && parametros.length > 0
                ? { components: [{ type: 'body', parameters: parametros.map((texto) => ({ type: 'text', text: texto })) }] }
                : {}),
            },
          }),
        },
      );

      const cuerpo = await respuesta.json().catch(() => null);
      const duracionMs = Date.now() - inicioEnvio;

      if (respuesta.ok) {
        whatsappMessageId = cuerpo?.messages?.[0]?.id ?? null;
        codigoEstado = 'enviado';
        this.logger.log(`WhatsApp aceptado por Meta en ${duracionMs} ms (a ${telefono}, plantilla ${nombrePlantilla}).`);
      } else {
        this.logger.error(`Meta respondió error al enviar WhatsApp tras ${duracionMs} ms: ${JSON.stringify(cuerpo)}`);
      }
    } catch (error) {
      const duracionMs = Date.now() - inicioEnvio;
      const motivo = controladorTiempoLimite.signal.aborted ? `tiempo de espera agotado (${TIEMPO_LIMITE_ENVIO_MS} ms)` : String(error);
      this.logger.error(`Error enviando WhatsApp tras ${duracionMs} ms: ${motivo}`);
    } finally {
      clearTimeout(temporizador);
    }

    const estado = await this.estadoRepository.findOne({
      where: { categoria: CategoriaEstado.NOTIFICACION, codigo: codigoEstado },
    });
    if (!estado) {
      this.logger.error(`Falta el seed del estado notificacion/${codigoEstado}; no se registra el intento.`);
      return;
    }

    const registro = this.notificacionRepository.create({
      estudianteId: opciones.estudianteId,
      acudienteId: opciones.acudienteId,
      tipoMensaje: opciones.tipoMensaje,
      estadoId: estado.id,
      whatsappMessageId,
      fechaEnvio: codigoEstado === 'enviado' ? new Date() : null,
      origenEventoId: opciones.origenEventoId,
    });

    await this.notificacionRepository.save(registro);
  }
}