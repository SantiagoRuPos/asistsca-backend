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
import { ExcusasService } from './excusas.service';
import { CrearExcusaDto } from './dto/crear-excusa.dto';
import { FiltrarExcusasDto } from './dto/filtrar-excusas.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';

const ROLES_GESTION = ['admin', 'rector', 'coordinador'];
const ROLES_LECTURA = [...ROLES_GESTION, 'profesor'];

const CARPETA_ADJUNTOS = join(process.cwd(), 'uploads', 'excusas');
mkdirSync(CARPETA_ADJUNTOS, { recursive: true });

const TIPOS_PERMITIDOS = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function obtenerTipoMime(nombreArchivo: string): string {
  const extension = extname(nombreArchivo).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  return 'application/octet-stream';
}

@Controller('excusas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExcusasController {
  constructor(private readonly excusasService: ExcusasService) {}

  @Post()
  @Roles(...ROLES_LECTURA)
  @Auditar('crear_excusa', 'excusa')
  crear(@Body() dto: CrearExcusaDto, @Req() request: any) {
    return this.excusasService.crear(dto, request.usuario.sub);
  }

  @Post('adjuntos')
  @Roles(...ROLES_LECTURA)
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
    return { url: `/excusas/adjuntos/${archivo.filename}`, nombre: archivo.originalname };
  }

  @Get('adjuntos/:nombreArchivo')
  @Roles(...ROLES_LECTURA)
  descargarAdjunto(@Param('nombreArchivo') nombreArchivo: string) {
    const nombreSeguro = basename(nombreArchivo);
    const ruta = join(CARPETA_ADJUNTOS, nombreSeguro);
    if (!existsSync(ruta)) {
      throw new NotFoundException('El archivo adjunto no existe.');
    }
    return new StreamableFile(createReadStream(ruta), { type: obtenerTipoMime(nombreSeguro) });
  }

  @Get()
  @Roles(...ROLES_LECTURA)
  listar(@Query() filtros: FiltrarExcusasDto) {
    return this.excusasService.listarFiltradas(filtros);
  }

  @Get('resumen')
  @Roles(...ROLES_LECTURA)
  obtenerResumen() {
    return this.excusasService.obtenerResumen();
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
