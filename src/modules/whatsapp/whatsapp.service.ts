import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificacionWhatsapp } from '../../config/entities/comunicaciones/notificacion-whatsapp.entity';
import { EstudianteAcudiente } from '../../config/entities/academico/estudiante-acudiente.entity';
import { Estado, CategoriaEstado } from '../../config/entities/catalogos/estado.entity';
import { EventoAsistencia, TipoEvento } from '../../config/entities/nfc/evento-asistencia.entity';
import { WhatsappConfigService } from './whatsapp-config.service';

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
        relations: ['acudiente'],
      });
      if (contactos.length === 0) return;

      const tipoMensaje = evento.tipoEvento === TipoEvento.ENTRADA ? 'entrada' : 'salida';
      const nombrePlantilla =
        evento.tipoEvento === TipoEvento.ENTRADA ? configuracion.plantillaEntrada : configuracion.plantillaSalida;
      const hora = evento.timestampEvento.toLocaleTimeString('es-CO', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
      });

      for (const contacto of contactos) {
        await this.enviarYRegistrar({
          estudianteId,
          acudienteId: contacto.acudienteId,
          telefono: contacto.acudiente.telefonoWhatsapp,
          tipoMensaje,
          nombrePlantilla,
          idioma: configuracion.idiomaPlantilla,
          parametros: [hora],
          configuracion,
          origenEventoId: evento.id,
        });
      }
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

    try {
      const respuesta = await fetch(
        `https://graph.facebook.com/${configuracion.apiVersion}/${configuracion.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${configuracion.accessToken}`,
            'Content-Type': 'application/json',
          },
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

      if (respuesta.ok) {
        whatsappMessageId = cuerpo?.messages?.[0]?.id ?? null;
        codigoEstado = 'enviado';
      } else {
        this.logger.error(`Meta respondió error al enviar WhatsApp: ${JSON.stringify(cuerpo)}`);
      }
    } catch (error) {
      this.logger.error(`Error de red enviando WhatsApp: ${error}`);
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