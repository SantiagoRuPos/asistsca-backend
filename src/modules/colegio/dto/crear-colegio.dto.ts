import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CrearColegioDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del colegio es obligatorio' })
  @MinLength(3)
  @MaxLength(200)
  nombre!: string;

  @IsString()
  @IsNotEmpty({ message: 'El NIT es obligatorio' })
  @Matches(/^[0-9]{5,15}(-[0-9])?$/, { message: 'NIT inválido (ej: 900123456-7)' })
  nit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,20}$/, { message: 'Teléfono inválido' })
  telefono?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anioLectivoActivo?: number;

  @IsOptional()
  @IsUrl({}, { message: 'logoUrl debe ser una URL válida' })
  logoUrl?: string;
}