import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AutorizacionesSalidaService } from './autorizaciones-salida.service';
import { CrearAutorizacionSalidaDto } from './dto/crear-autorizacion-salida.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';

const ROLES_PERMITIDOS = ['admin', 'rector', 'coordinador', 'profesor'];

@Controller('autorizaciones-salida')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AutorizacionesSalidaController {
  constructor(private readonly autorizacionesSalidaService: AutorizacionesSalidaService) {}

  @Post()
  @Roles(...ROLES_PERMITIDOS)
  @Auditar('crear_autorizacion_salida', 'autorizacion_salida')
  crear(@Body() dto: CrearAutorizacionSalidaDto, @Req() request: any) {
    return this.autorizacionesSalidaService.crear(dto, {
      sub: request.usuario.sub,
      rol: request.usuario.rol,
    });
  }

  @Get()
  @Roles(...ROLES_PERMITIDOS)
  listar(@Query('estudianteId') estudianteId?: string, @Query('fecha') fecha?: string) {
    return this.autorizacionesSalidaService.listar(estudianteId, fecha);
  }

  @Patch(':id/utilizada')
  @Roles(...ROLES_PERMITIDOS)
  marcarUtilizada(@Param('id') id: string) {
    return this.autorizacionesSalidaService.marcarUtilizada(id);
  }
}