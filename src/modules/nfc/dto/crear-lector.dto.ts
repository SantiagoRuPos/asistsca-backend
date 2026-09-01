import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearLectorDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  nombre!: string;

  @IsString() @IsNotEmpty() @MaxLength(60)
  codigoLector!: string;

  @IsOptional() @IsString() @MaxLength(200)
  descripcionUbicacion?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  descripcion?: string;
}
