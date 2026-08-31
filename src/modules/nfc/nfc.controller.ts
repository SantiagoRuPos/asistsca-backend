import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { NfcService } from './nfc.service';
import { CrearLectorDto } from './dto/crear-lector.dto';
import { AsignarTarjetaDto } from './dto/asignar-tarjeta.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('nfc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NfcController {
  constructor(private readonly nfcService: NfcService) {}

  @Post('lectores')
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin')
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
  asignarTarjeta(@Body() dto: AsignarTarjetaDto) {
    return this.nfcService.asignarTarjeta(dto);
  }

  @Get('tarjetas')
  @Roles('admin', 'rector', 'coordinador')
  listarTarjetas() {
    return this.nfcService.listarTarjetas();
  }
}