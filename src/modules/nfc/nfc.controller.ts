import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { NfcService } from './nfc.service';
import { CrearLectorDto } from './dto/crear-lector.dto';
import { AsignarTarjetaDto } from './dto/asignar-tarjeta.dto';
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
}