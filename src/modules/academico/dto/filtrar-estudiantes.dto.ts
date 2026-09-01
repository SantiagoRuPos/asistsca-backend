import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class FiltrarEstudiantesDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  cursoId?: string;

  @IsOptional()
  @IsString()
  estado?: string;

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
