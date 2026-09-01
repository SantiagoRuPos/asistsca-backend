import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CrearExcusaDto {
  @IsUUID()
  estudianteId!: string;

  @IsDateString({}, { message: 'fechaAusencia debe tener formato YYYY-MM-DD' })
  fechaAusencia!: string;

  @IsString()
  @IsNotEmpty()
  motivo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  tipoExcusa!: string;

  @IsOptional()
  @IsString()
  archivoSoporteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  archivoSoporteNombre?: string;
}
