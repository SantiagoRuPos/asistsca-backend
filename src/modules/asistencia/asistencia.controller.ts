import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AsistenciaService } from './asistencia.service';
import { RegistrarEventoDto } from './dto/registrar-evento.dto';
import { LectorApiKeyGuard } from '../../common/guards/lector-api-key.guard';
import { LicenciaExenta } from '../licenciamiento/decorators/licencia-exenta.decorator';

@Controller('api')
export class AsistenciaController {
  constructor(private readonly asistenciaService: AsistenciaService) {}

  // Ingesta de eventos del ESP32: SIEMPRE debe funcionar, sin importar el
  // estado de la licencia (ver LicenciaGuard) — bloquearla afecta directo al
  // colegio (no se registra asistencia, no llegan notificaciones a
  // acudientes), no solo presiona a SCA por el pago de la licencia.
  @Post('registrar_evento')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(LectorApiKeyGuard)
  @LicenciaExenta()
  registrarEvento(@Body() dto: RegistrarEventoDto, @Req() request: any) {
    return this.asistenciaService.registrarEvento(dto, request.lector);
  }

  // El firmware del ESP32 llama esto periódicamente solo para confirmar que
  // tiene conexión con el servidor y que su API key sigue siendo válida —
  // no registra ningún evento de asistencia. Reutiliza el mismo guard que
  // 'registrar_evento': si la API key es válida, LectorApiKeyGuard ya deja
  // el lector en `request.lector` y ya actualizó `ultimaConexion` por su cuenta
  // (así que este endpoint no tiene que volver a tocar la base de datos).
  // Es GET, así que LicenciaGuard ya lo deja pasar siempre; se marca exento
  // igual de forma explícita por si algún día cambia de método.
  @Get('health')
  @UseGuards(LectorApiKeyGuard)
  @LicenciaExenta()
  health(@Req() request: any) {
    return this.asistenciaService.obtenerHealthLector(request.lector);
  }
}