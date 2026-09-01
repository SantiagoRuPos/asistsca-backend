import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EntornoWhatsapp } from '../../config/entities/comunicaciones/configuracion-whatsapp.entity';
import { AppConfig } from '../../config/configuration';
import { cifrar, descifrar } from '../../common/utils/cifrado.util';
import { ConfigurarWhatsappDto } from './dto/configurar-whatsapp.dto';
import { ConfiguracionWhatsapp } from 'src/config/entities/comunicaciones/configuracion-whatsapp.entity';

@Injectable()
export class WhatsappConfigService {
  constructor(
    @InjectRepository(ConfiguracionWhatsapp)
    private readonly configuracionRepository: Repository<ConfiguracionWhatsapp>,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async obtener(): Promise<ConfiguracionWhatsapp | null> {
    return this.configuracionRepository.findOne({ where: {}, order: { fechaActualizacion: 'DESC' } });
  }

  async obtenerParaEnvio() {
    const configuracion = await this.obtener();
    if (!configuracion) return null;

    return {
      ...configuracion,
      accessToken: descifrar(configuracion.accessTokenCifrado, this.claveSecreta()),
    };
  }

  async obtenerEnmascarada() {
    const configuracion = await this.obtener();
    return configuracion ? this.enmascarar(configuracion) : null;
  }

  async probarConexion(): Promise<{ exitoso: boolean; mensaje: string }> {
    const configuracion = await this.obtenerParaEnvio();
    if (!configuracion) {
      return { exitoso: false, mensaje: 'No hay ninguna configuración de WhatsApp guardada todavía.' };
    }

    try {
      const respuesta = await fetch(
        `https://graph.facebook.com/${configuracion.apiVersion}/${configuracion.phoneNumberId}?fields=id`,
        { headers: { Authorization: `Bearer ${configuracion.accessToken}` } },
      );
      const cuerpo = await respuesta.json().catch(() => null);

      if (respuesta.ok) {
        return { exitoso: true, mensaje: 'La conexión con WhatsApp Business API funciona correctamente.' };
      }
      return {
        exitoso: false,
        mensaje: cuerpo?.error?.message ?? 'Meta respondió con un error al validar las credenciales.',
      };
    } catch {
      return {
        exitoso: false,
        mensaje: 'No se pudo contactar la API de WhatsApp. Revisa la conexión de red del servidor.',
      };
    }
  }

  async actualizar(dto: ConfigurarWhatsappDto, usuarioId: string) {
    let configuracion = await this.obtener();
    const accessTokenCifrado = cifrar(dto.accessToken, this.claveSecreta());

    if (!configuracion) {
      configuracion = this.configuracionRepository.create({
        entorno: dto.entorno,
        phoneNumberId: dto.phoneNumberId,
        accessTokenCifrado,
        apiVersion: dto.apiVersion ?? 'v21.0',
        plantillaEntrada: dto.plantillaEntrada ?? 'hello_world',
        plantillaSalida: dto.plantillaSalida ?? 'hello_world',
        idiomaPlantilla: dto.idiomaPlantilla ?? 'en_US',
        actualizadoPorUsuarioId: usuarioId,
      });
    } else {
      configuracion.entorno = dto.entorno;
      configuracion.phoneNumberId = dto.phoneNumberId;
      configuracion.accessTokenCifrado = accessTokenCifrado;
      if (dto.apiVersion) configuracion.apiVersion = dto.apiVersion;
      if (dto.plantillaEntrada) configuracion.plantillaEntrada = dto.plantillaEntrada;
      if (dto.plantillaSalida) configuracion.plantillaSalida = dto.plantillaSalida;
      if (dto.idiomaPlantilla) configuracion.idiomaPlantilla = dto.idiomaPlantilla;
      configuracion.actualizadoPorUsuarioId = usuarioId;
    }

    const guardada = await this.configuracionRepository.save(configuracion);
    return this.enmascarar(guardada);
  }

  private enmascarar(configuracion: ConfiguracionWhatsapp) {
    const { accessTokenCifrado, ...resto } = configuracion;
    return { ...resto, accessToken: '••••••••' };
  }

  private claveSecreta(): string {
    return this.configService.get('whatsapp.encryptionKey', { infer: true });
  }
}