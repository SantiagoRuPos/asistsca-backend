import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export enum VistaAsistencia {
  HOY = 'hoy',
  ENTRADAS = 'entradas',
  SALIDAS = 'salidas',
  HISTORIAL = 'historial',
}

export class FiltrarAsistenciaDiariaDto {
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsUUID()
  cursoId?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  lectorId?: string;

  @IsOptional()
  @IsIn(Object.values(VistaAsistencia))
  vista?: VistaAsistencia;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number = 10;
}
