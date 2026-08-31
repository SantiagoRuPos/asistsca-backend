import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDITORIA_KEY, MetadatosAuditoria } from '../decorators/auditar.decorator';
import { AuditoriaService } from '../../modules/auditoria/auditoria.service';

const CAMPOS_SENSIBLES = ['password', 'accessToken', 'passwordHash', 'refreshToken', 'token'];

@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadatos = this.reflector.get<MetadatosAuditoria>(AUDITORIA_KEY, context.getHandler());
    if (!metadatos) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap((respuesta) => {
        const entidadId =
          (respuesta && typeof respuesta === 'object' && 'id' in respuesta
            ? (respuesta as { id?: string }).id
            : undefined) ?? request.params?.id ?? null;

        void this.auditoriaService.registrar({
          usuarioId: request.usuario?.sub ?? null,
          accion: metadatos.accion,
          entidad: metadatos.entidad,
          entidadId,
          detalle: this.limpiarBody(request.body),
          ip: request.ip ?? null,
        });
      }),
    );
  }

  private limpiarBody(body: unknown): Record<string, unknown> | null {
    if (!body || typeof body !== 'object') return null;
    const copia: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const campo of CAMPOS_SENSIBLES) {
      if (campo in copia) copia[campo] = '[oculto]';
    }
    return copia;
  }
}