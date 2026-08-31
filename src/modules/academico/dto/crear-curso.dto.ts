import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Jornada } from '../../../config/entities/academico/curso.entity';

export class CrearCursoDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(40)
  nombre!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anioLectivo?: number;

  @IsUUID()
  @IsNotEmpty()
  profesorDirectorId!: string;

  @IsOptional()
  @IsEnum(Jornada, { message: 'jornada debe ser mañana, tarde o unica' })
  jornada?: Jornada;
}