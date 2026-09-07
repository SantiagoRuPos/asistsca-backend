import { Controller, Get, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { InformeEstudianteQueryDto } from './dto/informe-estudiante-query.dto';
import { InformeCursoQueryDto } from './dto/informe-curso-query.dto';
import { InformeColegioQueryDto } from './dto/informe-colegio-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';

const TIPO_MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Descargar informes de asistencia (con datos de todo el colegio) se
// restringe a los mismos roles que ya pueden ver Asistencias/Estudiantes —
// un profesor no ve esta pantalla ni puede llamar estos endpoints
// directamente, a diferencia de otras rutas de solo lectura del proyecto.
const ROLES_INFORMES = ['admin', 'rector', 'coordinador'];

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_INFORMES)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('asistencia/estudiante')
  @Auditar('descargar_informe_asistencia_estudiante', 'asistencia_diaria')
  async informeEstudiante(@Query() dto: InformeEstudianteQueryDto): Promise<StreamableFile> {
    const { buffer, nombreArchivo } = await this.reportesService.generarInformeEstudiante(dto);
    return new StreamableFile(buffer, { type: TIPO_MIME_XLSX, disposition: `attachment; filename="${nombreArchivo}"` });
  }

  @Get('asistencia/curso')
  @Auditar('descargar_informe_asistencia_curso', 'asistencia_diaria')
  async informeCurso(@Query() dto: InformeCursoQueryDto): Promise<StreamableFile> {
    const { buffer, nombreArchivo } = await this.reportesService.generarInformeCurso(dto);
    return new StreamableFile(buffer, { type: TIPO_MIME_XLSX, disposition: `attachment; filename="${nombreArchivo}"` });
  }

  @Get('asistencia/colegio')
  @Auditar('descargar_informe_asistencia_colegio', 'asistencia_diaria')
  async informeColegio(@Query() dto: InformeColegioQueryDto): Promise<StreamableFile> {
    const { buffer, nombreArchivo } = await this.reportesService.generarInformeColegio(dto);
    return new StreamableFile(buffer, { type: TIPO_MIME_XLSX, disposition: `attachment; filename="${nombreArchivo}"` });
  }
}
