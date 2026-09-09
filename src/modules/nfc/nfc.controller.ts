import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { NfcService } from './nfc.service';
import { CrearLectorDto } from './dto/crear-lector.dto';
import { AsignarTarjetaDto } from './dto/asignar-tarjeta.dto';
import { CambiarTarjetaEstudianteDto } from './dto/cambiar-tarjeta-estudiante.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';

@Controller('nfc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NfcController {
  constructor(private readonly nfcService: NfcService) {}

  @Post('lectores')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin')
  @Auditar('crear_lector', 'lector_nfc')
  crearLector(@Body() dto: CrearLectorDto) {
    return this.nfcService.crearLector(dto);
  }

  @Get('lectores')
  @Roles('admin', 'rector', 'coordinador')
  listarLectores() {
    return this.nfcService.listarLectores();
  }

  @Post('tarjetas')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'coordinador')
  @Auditar('asignar_tarjeta', 'tarjeta_nfc')
  asignarTarjeta(@Body() dto: AsignarTarjetaDto) {
    return this.nfcService.asignarTarjeta(dto);
  }

  // Un profesor puede ver los carnets (incluido el UID) para usarlos como
  // referencia al registrar asistencia manual desde la pantalla de Carnets
  // — no puede asignar carnets nuevos (POST arriba sigue admin/coordinador).
  @Get('tarjetas')
  @Roles('admin', 'rector', 'coordinador', 'profesor')
  listarTarjetas() {
    return this.nfcService.listarTarjetas();
  }

  // Reemplazo de carnet extraviado/dañado: desactiva la tarjeta anterior (se
  // conserva como historial) y crea una nueva con el UID indicado. Mismos
  // roles que la asignación original de tarjetas.
  @Patch('tarjetas/estudiante/:estudianteId')
  @Roles('admin', 'coordinador')
  @Auditar('cambiar_tarjeta_estudiante', 'tarjeta_nfc')
  cambiarTarjetaEstudiante(
    @Param('estudianteId', ParseUUIDPipe) estudianteId: string,
    @Body() dto: CambiarTarjetaEstudianteDto,
  ) {
    return this.nfcService.cambiarTarjetaEstudiante(estudianteId, dto);
  }

  // Para el formulario "Asignar carnet": mismos roles que pueden asignar,
  // así el frontend puede ofrecer el UID recién escaneado sin que alguien
  // tenga que copiarlo a mano.
  @Get('tarjetas/desconocidas/ultima')
  @Roles('admin', 'coordinador')
  obtenerUltimaTarjetaDesconocida() {
    return this.nfcService.obtenerUltimaTarjetaDesconocida();
  }
}