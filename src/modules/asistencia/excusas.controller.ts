import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ExcusasService } from './excusas.service';
import { CrearExcusaDto } from './dto/crear-excusa.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';

const ROLES_GESTION = ['admin', 'rector', 'coordinador'];

@Controller('excusas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExcusasController {
  constructor(private readonly excusasService: ExcusasService) {}

  @Post()
  @Roles(...ROLES_GESTION, 'profesor')
  crear(@Body() dto: CrearExcusaDto, @Req() request: any) {
    return this.excusasService.crear(dto, request.usuario.sub);
  }

  @Get()
  @Roles(...ROLES_GESTION, 'profesor')
  listar(@Query('estudianteId') estudianteId?: string) {
    return this.excusasService.listar(estudianteId);
  }

  @Patch(':id/aprobar')
  @Roles(...ROLES_GESTION)
  @Auditar('aprobar_excusa', 'excusa')
  aprobar(@Param('id') id: string, @Req() request: any) {
    return this.excusasService.aprobar(id, request.usuario.sub);
  }

  @Patch(':id/rechazar')
  @Roles(...ROLES_GESTION)
  @Auditar('rechazar_excusa', 'excusa')
  rechazar(@Param('id') id: string, @Req() request: any) {
    return this.excusasService.rechazar(id, request.usuario.sub);
  }
}