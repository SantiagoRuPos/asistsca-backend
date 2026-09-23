import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { basename, extname, join } from 'path';
import { randomUUID } from 'crypto';
import { AutorizacionesSalidaService } from './autorizaciones-salida.service';
import { CrearAutorizacionSalidaDto } from './dto/crear-autorizacion-salida.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';

const ROLES_PERMITIDOS = ['admin', 'rector', 'coordinador', 'profesor'];

// Mismo patrón de adjuntos que ExcusasController (PDF/JPG/PNG, 5MB, nombre
// aleatorio en disco) — se duplica en vez de compartirse entre módulos
// porque cada uno guarda en su propia carpeta y ninguno depende del otro.
const CARPETA_ADJUNTOS = join(process.cwd(), 'uploads', 'autorizaciones-salida');
mkdirSync(CARPETA_ADJUNTOS, { recursive: true });

const TIPOS_PERMITIDOS = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function obtenerTipoMime(nombreArchivo: string): string {
  const extension = extname(nombreArchivo).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  return 'application/octet-stream';
}

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

  // Declarado ANTES de ':id' — si no, Express intentaría resolver
  // "adjuntos" como si fuera un :id.
  @Post('adjuntos')
  @Roles(...ROLES_PERMITIDOS)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: CARPETA_ADJUNTOS,
        filename: (_req, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
          callback(new BadRequestException('Solo se aceptan archivos PDF, JPG o PNG.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  subirAdjunto(@UploadedFile() archivo: Express.Multer.File) {
    if (!archivo) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }
    return { url: `/autorizaciones-salida/adjuntos/${archivo.filename}`, nombre: archivo.originalname };
  }

  @Get('adjuntos/:nombreArchivo')
  @Roles(...ROLES_PERMITIDOS)
  descargarAdjunto(@Param('nombreArchivo') nombreArchivo: string) {
    const nombreSeguro = basename(nombreArchivo);
    const ruta = join(CARPETA_ADJUNTOS, nombreSeguro);
    if (!existsSync(ruta)) {
      throw new NotFoundException('El archivo adjunto no existe.');
    }
    return new StreamableFile(createReadStream(ruta), { type: obtenerTipoMime(nombreSeguro) });
  }

  @Get(':id')
  @Roles(...ROLES_PERMITIDOS)
  obtener(@Param('id') id: string) {
    return this.autorizacionesSalidaService.obtener(id);
  }

  @Get(':id/pdf')
  @Roles(...ROLES_PERMITIDOS)
  async descargarPdf(@Param('id') id: string): Promise<StreamableFile> {
    const { buffer, nombreArchivo } = await this.autorizacionesSalidaService.generarPdf(id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${nombreArchivo}"`,
    });
  }

  @Patch(':id/utilizada')
  @Roles(...ROLES_PERMITIDOS)
  marcarUtilizada(@Param('id') id: string) {
    return this.autorizacionesSalidaService.marcarUtilizada(id);
  }
}
