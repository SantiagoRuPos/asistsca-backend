import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { RegistrarUsuarioDto } from './dto/registrar-usuario.dto';
import { FiltrarUsuariosDto } from './dto/filtrar-usuarios.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';

// La gestión de cuentas (crear, activar, desactivar) queda reservada a
// admin y rector: es más sensible que otras pantallas (permite crear otras
// cuentas admin) y coordinador no la necesita para su labor diaria.
const ROLES_GESTION_USUARIOS = ['admin', 'rector'];

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post('registro-usuarios')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Auditar('crear_usuario_inicial', 'usuario')
  crear(@Body() dto: CrearUsuarioDto) {
    return this.usuariosService.crear(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION_USUARIOS)
  listar(@Query() filtros: FiltrarUsuariosDto) {
    return this.usuariosService.listarFiltrados(filtros);
  }

  @Get('resumen')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION_USUARIOS)
  obtenerResumen() {
    return this.usuariosService.obtenerResumen();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION_USUARIOS)
  @Auditar('registrar_usuario', 'usuario')
  registrar(@Body() dto: RegistrarUsuarioDto) {
    return this.usuariosService.registrar(dto);
  }

  @Patch(':id/activar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION_USUARIOS)
  @Auditar('activar_usuario', 'usuario')
  activar(@Param('id') id: string) {
    return this.usuariosService.activar(id);
  }

  @Patch(':id/desactivar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_GESTION_USUARIOS)
  @Auditar('desactivar_usuario', 'usuario')
  desactivar(@Param('id') id: string, @Req() req: any) {
    return this.usuariosService.desactivar(id, req.usuario.sub);
  }
}
