import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { WhatsappConfigService } from './whatsapp-config.service';
import { ConfigurarWhatsappDto } from './dto/configurar-whatsapp.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';

@Controller('whatsapp/configuracion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class WhatsappController {
  constructor(private readonly whatsappConfigService: WhatsappConfigService) {}

  @Get()
  obtener() {
    return this.whatsappConfigService.obtenerEnmascarada();
  }

  @Put()
  @Auditar('actualizar_configuracion_whatsapp', 'configuracion_whatsapp')
  actualizar(@Body() dto: ConfigurarWhatsappDto, @Req() request: any) {
    return this.whatsappConfigService.actualizar(dto, request.usuario.sub);
  }
}