import { SetMetadata } from '@nestjs/common';

export const LICENCIA_EXENTA_KEY = 'licenciaExenta';

/**
 * Marca una ruta como SIEMPRE permitida por LicenciaGuard, sin importar el
 * estado de la licencia (activa, aviso o degradada). Úsalo solo en rutas que
 * deban seguir funcionando incluso con la licencia vencida:
 *   - Ingesta NFC del ESP32 (registrar_evento) — bloquearla afecta directo al
 *     colegio (no se registra asistencia, no llegan notificaciones a acudientes),
 *     no solo presiona a SCA por el pago.
 *   - Login/refresh/logout — para que un administrador siempre pueda entrar y
 *     ver el aviso de licencia, incluso en degradación total.
 *
 * Las lecturas (GET/HEAD/OPTIONS) YA están exentas siempre a nivel de guard
 * sin necesidad de este decorador (la Fase 1 solo bloquea escrituras).
 */
export const LicenciaExenta = () => SetMetadata(LICENCIA_EXENTA_KEY, true);
