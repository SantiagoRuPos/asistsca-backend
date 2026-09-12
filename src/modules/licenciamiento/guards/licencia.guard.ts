import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicenciaTokenService } from '../licencia-token.service';
import { LICENCIA_EXENTA_KEY } from '../decorators/licencia-exenta.decorator';

const METODOS_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

// El frontend usa este código para distinguir "te bloqueó la licencia" de
// cualquier otro 403 (por ejemplo RolesGuard, que no lo incluye) y así poder
// mostrar un mensaje específico en vez del genérico de "sin permiso".
export const CODIGO_ERROR_LICENCIA_DEGRADADA = 'LICENCIA_DEGRADADA';

/**
 * Guard GLOBAL (registrado como APP_GUARD en app.module.ts, igual que
 * ThrottlerGuard) que aplica a TODAS las rutas de la aplicación.
 *
 * Reglas, en orden:
 *  1. Lecturas (GET/HEAD/OPTIONS) siempre pasan — Fase 1 solo bloquea
 *     escrituras, sin importar el estado de la licencia.
 *  2. Rutas marcadas con @LicenciaExenta() siempre pasan (ingesta NFC del
 *     ESP32, login/refresh/logout) — deben seguir funcionando incluso con
 *     la licencia vencida.
 *  3. Todo lo demás depende del estado calculado por LicenciaTokenService:
 *     'activa' o 'aviso' → pasa; 'degradada' → 403.
 */
@Injectable()
export class LicenciaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly licenciaTokenService: LicenciaTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (METODOS_LECTURA.has(request.method)) {
      return true;
    }

    const exenta = this.reflector.getAllAndOverride<boolean>(LICENCIA_EXENTA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (exenta) {
      return true;
    }

    const estado = await this.licenciaTokenService.obtenerEstado();
    if (estado.bloqueaEscrituras) {
      // Objeto explícito (no un string) para que Nest use este cuerpo tal
      // cual, con `codigoError` incluido — así el interceptor del frontend
      // puede reconocer este 403 específico sin adivinar por el texto del
      // mensaje (que además puede cambiar de redacción con el tiempo).
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: estado.mensaje,
        codigoError: CODIGO_ERROR_LICENCIA_DEGRADADA,
      });
    }

    return true;
  }
}
