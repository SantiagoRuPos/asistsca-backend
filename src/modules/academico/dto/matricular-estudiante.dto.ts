import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class MatricularEstudianteDto {
  @IsUUID() @IsNotEmpty()
  estudianteId!: string;

  @IsUUID() @IsNotEmpty()
  cursoId!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  anioLectivo?: number;
}