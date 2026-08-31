import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
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
}