import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class EstudianteMasivoItemDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  nombres!: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  apellidos!: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  tipoDocumento!: string;

  @IsString() @IsNotEmpty() @MaxLength(30)
  numeroDocumento!: string;

  @IsDateString({}, { message: 'fechaNacimiento debe tener formato YYYY-MM-DD' })
  fechaNacimiento!: string;

  @IsOptional() @IsUUID()
  cursoId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  anioLectivo?: number;
}