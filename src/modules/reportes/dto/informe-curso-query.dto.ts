import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class InformeCursoQueryDto {
  @IsUUID()
  cursoId!: string;

  @IsDateString({}, { message: 'fechaInicio debe tener formato YYYY-MM-DD' })
  fechaInicio!: string;

  @IsDateString({}, { message: 'fechaFin debe tener formato YYYY-MM-DD' })
  fechaFin!: string;

  // (2026-09-25) Formato de descarga: ademas de Excel (el original, con
  // el detalle dia a dia), ahora tambien se puede pedir un PDF de una
  // sola pagina con el resumen -- pensado para imprimir o compartir
  // rapido, sin el detalle registro por registro.
  @IsOptional()
  @IsIn(['xlsx', 'pdf'])
  formato?: 'xlsx' | 'pdf';
}
