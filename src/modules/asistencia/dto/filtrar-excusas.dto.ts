import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class FiltrarExcusasDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  cursoId?: string;

  @IsOptional()
  @IsIn(['pendiente', 'aprobada', 'rechazada'])
  estado?: string;

  @IsOptional()
  @IsDateString({}, { message: 'fechaInicio debe tener formato YYYY-MM-DD' })
  fechaInicio?: string;

  @IsOptional()
  @IsDateString({}, { message: 'fechaFin debe tener formato YYYY-MM-DD' })
  fechaFin?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limite?: number = 10;
}
