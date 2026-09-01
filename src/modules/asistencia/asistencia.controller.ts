import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AsistenciaService } from './asistencia.service';
import { RegistrarEventoDto } from './dto/registrar-evento.dto';
import { LectorApiKeyGuard } from '../../common/guards/lector-api-key.guard';

@Controller('api')
export class AsistenciaController {
  constructor(private readonly asistenciaService: AsistenciaService) {}

  @Post('registrar_evento')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(LectorApiKeyGuard)
  registrarEvento(@Body() dto: RegistrarEventoDto, @Req() request: any) {
    return this.asistenciaService.registrarEvento(dto, request.lector);
  }

  // El firmware del ESP32 llama esto periódicamente solo para confirmar que
  // tiene conexión con el servidor y que su API key sigue siendo válida —
  // no registra ningún evento de asistencia. Reutiliza el mismo guard que
  // 'registrar_evento': si la API key es válida, LectorApiKeyGuard ya deja
  // el lector en `request.lector` y ya actualizó `ultimaConexion` por su cuenta
  // (así que este endpoint no tiene que volver a tocar la base de datos).
  @Get('health')
  @UseGuards(LectorApiKeyGuard)
  health(@Req() request: any) {
    return this.asistenciaService.obtenerHealthLector(request.lector);
  }
}