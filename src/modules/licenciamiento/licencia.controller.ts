import { Controller, Get, UseGuards } from '@nestjs/common';
import { LicenciaTokenService } from './licencia-token.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Endpoint de solo lectura para que el frontend muestre el banner de estado
 * de licencia (activa / aviso / degradada) y, mientras no haya un token
 * válido cargado, para que un administrador pueda leer el fingerprint de
 * ESTE servidor y enviárselo a SCA Solutions para que se le emita la
 * licencia correspondiente (flujo manual de Fase 1 — Fase 2 automatizará
 * esto contra el servidor de licencias real).
 *
 * No necesita @LicenciaExenta(): al ser un GET, LicenciaGuard ya lo deja
 * pasar siempre (Fase 1 solo bloquea escrituras).
 */
@Controller('licencia')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LicenciaController {
  constructor(private readonly licenciaTokenService: LicenciaTokenService) {}

  @Get('estado')
  @Roles('admin', 'rector')
  async obtenerEstado() {
    return this.licenciaTokenService.obtenerEstado();
  }
}
