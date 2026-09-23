import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AppConfig } from '../../config/configuration';
import { LicenciaEstado } from '../../config/entities/licenciamiento/licencia-estado.entity';
import { calcularFingerprintServidor } from './utils/fingerprint.util';
import { TelegramApiService } from '../../telegram_bot/telegram-api.service';

export type NivelLicencia = 'activa' | 'aviso' | 'degradada';

export interface EstadoLicencia {
  nivel: NivelLicencia;
  bloqueaEscrituras: boolean;
  mensaje: string;
  fingerprintServidor: string;
  diasSinValidarExitosamente: number | null;
  diasRestantesDeGracia: number | null;
  fechaUltimaValidacionExitosa: Date | null;
  fechaExpiracionToken: Date | null;
  cliente: string | null;
  plan: string | null;
  modulosHabilitados: string[] | null;
}

interface ClaimsLicencia {
  cliente?: string;
  plan?: string;
  limites?: Record<string, number>;
  modulos?: string[];
  fingerprint?: string;
  iat?: number;
  exp?: number;
}

// Cuánto tiempo se reutiliza el último resultado antes de volver a leer el
// archivo del token y recalcular todo. Evita que cada request HTTP (el guard
// corre en TODAS las rutas) le pegue al disco y a la base de datos.
const TTL_CACHE_MS = 60_000;

@Injectable()
export class LicenciaTokenService {
  private readonly logger = new Logger(LicenciaTokenService.name);
  private cache: { estado: EstadoLicencia; expiraEn: number } | null = null;

  constructor(
    @InjectRepository(LicenciaEstado)
    private readonly licenciaEstadoRepository: Repository<LicenciaEstado>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly telegramApiService: TelegramApiService,
  ) {}

  /**
   * Punto de entrada usado por LicenciaGuard en cada request. Cacheado por
   * TTL_CACHE_MS — NO vuelve a validar el JWT en cada llamada.
   */
  async obtenerEstado(): Promise<EstadoLicencia> {
    if (this.cache && this.cache.expiraEn > Date.now()) {
      return this.cache.estado;
    }
    return this.revalidar();
  }

  /**
   * Fuerza una revalidación completa ahora mismo (usado también por el job
   * de renovación periódica tras intentar traer un token nuevo). Este método
   * es el único lugar donde se escribe en `licencia_estado`.
   */
  async revalidar(): Promise<EstadoLicencia> {
    const registro = await this.obtenerOCrearRegistro();
    const fingerprintServidor = calcularFingerprintServidor();
    const tokenCrudo = this.leerTokenDeDisco();

    const claims = tokenCrudo ? this.verificarFirmaYExpiracion(tokenCrudo) : null;

    const estado =
      claims && this.verificarFingerprint(claims, fingerprintServidor, registro)
        ? await this.marcarValidacionExitosa(registro, tokenCrudo!, claims, fingerprintServidor)
        : this.calcularEstadoDeGracia(registro, fingerprintServidor);

    await this.gestionarAlertaTelegram(estado, registro);
    this.guardarEnCache(estado);
    return estado;
  }

  /**
   * Avisa a SCA por Telegram (no al colegio) cuando esta instalación pasa a
   * "aviso"/"degradada", y una vez más cuando se recupera. Se dispara desde
   * `revalidar()` (como mucho cada TTL_CACHE_MS = 60s, nunca en cada
   * request), y solo reenvía si el nivel realmente CAMBIÓ desde la última
   * alerta — así un "aviso" que dura 20 días no manda 20 días de mensajes
   * repetidos. `registro.alertaTelegramNivel` es lo que recuerda el último
   * nivel por el que ya se avisó (ver la entity).
   *
   * Best-effort y silencioso ante fallos de Telegram: un aviso que no llega
   * nunca debe afectar el resultado de `/licencia/estado` ni el guard.
   */
  private async gestionarAlertaTelegram(estado: EstadoLicencia, registro: LicenciaEstado): Promise<void> {
    const chatId = this.configService.get('licencia.alertaTelegramChatId', { infer: true });
    if (!chatId) return; // No configurado — la función queda apagada sin romper nada.

    const nivelParaAlerta: 'aviso' | 'degradada' | null = estado.nivel === 'activa' ? null : estado.nivel;
    if (registro.alertaTelegramNivel === nivelParaAlerta) return; // Ya se avisó de este mismo estado.

    const identificacion = registro.clienteCodigo ?? `instalación sin identificar (fingerprint ${estado.fingerprintServidor})`;

    try {
      if (nivelParaAlerta) {
        const emoji = nivelParaAlerta === 'degradada' ? '🔴' : '🟡';
        await this.telegramApiService.enviarMensaje(
          chatId,
          `${emoji} AsistSCA — ${identificacion}
Licencia en nivel "${nivelParaAlerta}".
${estado.mensaje}`,
        );
      } else {
        await this.telegramApiService.enviarMensaje(
          chatId,
          `✅ AsistSCA — ${identificacion}
La licencia volvió a validar correctamente (nivel "activa").`,
        );
      }
    } catch (error) {
      this.logger.error(`No se pudo enviar la alerta de licencia por Telegram: ${(error as Error).message}`);
    }

    registro.alertaTelegramNivel = nivelParaAlerta;
    await this.licenciaEstadoRepository.save(registro);
  }

  // --- Paso 1: firma + expiración -----------------------------------------

  private verificarFirmaYExpiracion(tokenCrudo: string): ClaimsLicencia | null {
    let llavePublica: string;
    try {
      llavePublica = this.leerLlavePublica();
    } catch (error) {
      this.logger.error(`No se pudo leer la llave pública de licenciamiento: ${(error as Error).message}`);
      return null;
    }

    try {
      return this.jwtService.verify<ClaimsLicencia>(tokenCrudo, {
        publicKey: llavePublica,
        algorithms: ['ES256'],
      });
    } catch (error) {
      this.logger.warn(`Token de licencia inválido o expirado: ${(error as Error).message}`);
      return null;
    }
  }

  // --- Paso 2: fingerprint (independiente de la firma del JWT) -----------

  private verificarFingerprint(
    claims: ClaimsLicencia,
    fingerprintServidor: string,
    registro: LicenciaEstado,
  ): boolean {
    if (!claims.fingerprint || claims.fingerprint !== fingerprintServidor) {
      this.logger.warn('El fingerprint del token de licencia no coincide con el de este servidor.');
      return false;
    }

    // Si ya había un fingerprint sellado antes (primera validación exitosa
    // histórica) y ahora cambió, no se acepta aunque el token sea válido y
    // tenga el fingerprint "correcto" — evita que alguien reemplace también
    // el sellado de la base de datos manualmente sin pasar por SCA. En Fase 1
    // (sin servidor de licencias) la única reautorización posible es borrar
    // el campo a mano en la base de datos.
    if (registro.fingerprintSellado && registro.fingerprintSellado !== fingerprintServidor) {
      this.logger.warn('El fingerprint sellado de esta instalación no coincide con el fingerprint actual.');
      return false;
    }

    return true;
  }

  // --- Paso 3: persistir éxito ---------------------------------------------

  private async marcarValidacionExitosa(
    registro: LicenciaEstado,
    tokenCrudo: string,
    claims: ClaimsLicencia,
    fingerprintServidor: string,
  ): Promise<EstadoLicencia> {
    const ahora = new Date();

    registro.ultimoTokenCrudo = tokenCrudo;
    registro.fechaUltimaValidacionExitosa = ahora;
    registro.fechaExpiracionToken = claims.exp ? new Date(claims.exp * 1000) : null;
    registro.clienteCodigo = claims.cliente ?? null;
    registro.plan = claims.plan ?? null;
    registro.modulosHabilitados = claims.modulos ?? null;
    registro.limites = claims.limites ?? null;

    if (!registro.fingerprintSellado) {
      registro.fingerprintSellado = fingerprintServidor;
      registro.fechaSellado = ahora;
    }

    await this.licenciaEstadoRepository.save(registro);

    return {
      nivel: 'activa',
      bloqueaEscrituras: false,
      mensaje: 'Licencia activa.',
      fingerprintServidor,
      diasSinValidarExitosamente: 0,
      diasRestantesDeGracia: null,
      fechaUltimaValidacionExitosa: ahora,
      fechaExpiracionToken: registro.fechaExpiracionToken,
      cliente: registro.clienteCodigo,
      plan: registro.plan,
      modulosHabilitados: registro.modulosHabilitados,
    };
  }

  // --- Sin token válido: calcular aviso / degradación ----------------------

  /**
   * Reparte en dos casos MUY distintos, aunque ambos lleguen aquí por la
   * misma razón inmediata (no hay un token que valide ahora mismo):
   *
   *  - `registro.fechaUltimaValidacionExitosa` existe → esta instalación SÍ
   *    tuvo una licencia real antes y ahora no se pudo renovar (token
   *    vencido, sin conexión al servidor de licencias). Es un cliente real
   *    con un problema de renovación: se le da el colchón completo
   *    (`diasAviso` + `diasDegradacionAdicional`, confirmado con el usuario:
   *    15 + 7 días) contado desde esa última validación.
   *  - `registro.fechaUltimaValidacionExitosa` es null → esta instalación
   *    JAMÁS ha validado una licencia — instalación nueva legítima
   *    esperando su primer token de SCA, O alguien con un token falsificado/
   *    copiado de otro servidor (falla la firma o el fingerprint) intentando
   *    usar el sistema sin haber pagado nunca. Ambos casos se ven idénticos
   *    desde este método (no hay forma de distinguir "nuevo cliente
   *    legítimo" de "pirata" solo con esto), así que se les da un colchón
   *    mucho más corto (`diasGraciaPrimeraActivacion`, confirmado: 3 días) —
   *    suficiente para el flujo real de activación (leer el fingerprint,
   *    mandarlo a SCA, recibir el token), no para usar el sistema gratis
   *    semanas enteras.
   */
  private calcularEstadoDeGracia(registro: LicenciaEstado, fingerprintServidor: string): EstadoLicencia {
    if (!registro.fechaUltimaValidacionExitosa) {
      return this.calcularEstadoPrimeraActivacion(registro, fingerprintServidor);
    }
    return this.calcularEstadoRenovacionFallida(registro, fingerprintServidor);
  }

  private calcularEstadoPrimeraActivacion(registro: LicenciaEstado, fingerprintServidor: string): EstadoLicencia {
    const diasGracia = this.configService.get('licencia.diasGraciaPrimeraActivacion', { infer: true });
    const diasTranscurridos = this.diasTranscurridosDesde(registro.creadoEn);

    if (diasTranscurridos <= diasGracia) {
      const diasRestantes = diasGracia - diasTranscurridos;
      return this.construirEstado(registro, fingerprintServidor, {
        nivel: 'aviso',
        bloqueaEscrituras: false,
        mensaje: `Esta instalación de AsistSCA todavía no tiene una licencia activa. Quedan ${diasRestantes} día(s) para activarla (contacta a SCA Solutions con el fingerprint de este servidor) antes de que se bloqueen las funciones de edición.`,
        diasTranscurridos,
        diasRestantes,
      });
    }

    return this.construirEstado(registro, fingerprintServidor, {
      nivel: 'degradada',
      bloqueaEscrituras: true,
      mensaje:
        'Esta instalación de AsistSCA nunca ha activado una licencia válida. Las funciones de consulta siguen ' +
        'disponibles, pero los cambios (registrar, editar, eliminar) están bloqueados. Contacta a SCA Solutions ' +
        'con el fingerprint de este servidor para activarla.',
      diasTranscurridos,
      diasRestantes: 0,
    });
  }

  private calcularEstadoRenovacionFallida(registro: LicenciaEstado, fingerprintServidor: string): EstadoLicencia {
    const diasAviso = this.configService.get('licencia.diasAviso', { infer: true });
    const diasDegradacionAdicional = this.configService.get('licencia.diasDegradacionAdicional', { infer: true });
    const diasTranscurridos = this.diasTranscurridosDesde(registro.fechaUltimaValidacionExitosa!);

    // Colchón TOTAL confirmado con el usuario: 15 días de aviso + 7 días
    // adicionales antes de bloquear escrituras de verdad = 22 días. Durante
    // todo ese tramo se muestra 'aviso' (Fase 1 no tiene un cuarto estado
    // visual para "aviso urgente") — solo después de los 22 días completos
    // pasa a 'degradada'.
    const limiteBloqueo = diasAviso + diasDegradacionAdicional;

    if (diasTranscurridos <= limiteBloqueo) {
      const diasRestantes = limiteBloqueo - diasTranscurridos;
      return this.construirEstado(registro, fingerprintServidor, {
        nivel: 'aviso',
        bloqueaEscrituras: false,
        mensaje: `No se ha podido renovar la licencia de AsistSCA. Quedan ${diasRestantes} día(s) antes de que se bloqueen las funciones de edición. Contacta a SCA Solutions.`,
        diasTranscurridos,
        diasRestantes,
      });
    }

    return this.construirEstado(registro, fingerprintServidor, {
      nivel: 'degradada',
      bloqueaEscrituras: true,
      mensaje:
        'La licencia de AsistSCA está vencida. Las funciones de consulta siguen disponibles, pero los cambios ' +
        '(registrar, editar, eliminar) están bloqueados hasta renovarla. Contacta a SCA Solutions para reactivarla.',
      diasTranscurridos,
      diasRestantes: 0,
    });
  }

  private diasTranscurridosDesde(fecha: Date): number {
    return Math.floor((Date.now() - fecha.getTime()) / (24 * 60 * 60 * 1000));
  }

  private construirEstado(
    registro: LicenciaEstado,
    fingerprintServidor: string,
    datos: {
      nivel: NivelLicencia;
      bloqueaEscrituras: boolean;
      mensaje: string;
      diasTranscurridos: number;
      diasRestantes: number;
    },
  ): EstadoLicencia {
    return {
      nivel: datos.nivel,
      bloqueaEscrituras: datos.bloqueaEscrituras,
      mensaje: datos.mensaje,
      fingerprintServidor,
      diasSinValidarExitosamente: datos.diasTranscurridos,
      diasRestantesDeGracia: datos.diasRestantes,
      fechaUltimaValidacionExitosa: registro.fechaUltimaValidacionExitosa,
      fechaExpiracionToken: registro.fechaExpiracionToken,
      cliente: registro.clienteCodigo,
      plan: registro.plan,
      modulosHabilitados: registro.modulosHabilitados,
    };
  }

  // --- Infraestructura ------------------------------------------------------

  private async obtenerOCrearRegistro(): Promise<LicenciaEstado> {
    const existente = await this.licenciaEstadoRepository.find({ order: { creadoEn: 'ASC' }, take: 1 });
    if (existente.length > 0) {
      return existente[0];
    }
    const nuevo = this.licenciaEstadoRepository.create({});
    return this.licenciaEstadoRepository.save(nuevo);
  }

  private leerTokenDeDisco(): string | null {
    const ruta = resolve(process.cwd(), this.configService.get('licencia.tokenPath', { infer: true }));
    try {
      return readFileSync(ruta, 'utf8').trim();
    } catch {
      return null;
    }
  }

  private leerLlavePublica(): string {
    const ruta = resolve(process.cwd(), this.configService.get('licencia.publicKeyPath', { infer: true }));
    return readFileSync(ruta, 'utf8');
  }

  private guardarEnCache(estado: EstadoLicencia): void {
    this.cache = { estado, expiraEn: Date.now() + TTL_CACHE_MS };
  }
}
