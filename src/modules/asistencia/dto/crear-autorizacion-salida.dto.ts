import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CrearAutorizacionSalidaDto {
  @IsUUID()
  estudianteId!: string;

  @IsDateString({}, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'horaAutorizada debe tener formato HH:mm o HH:mm:ss',
  })
  horaAutorizada!: string;

  @IsUUID()
  acudienteAutorizaId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombrePersonaRecoge!: string;

  @IsString()
  @IsNotEmpty()
  motivo!: string;

  // Igual que CrearExcusaDto.archivoSoporteUrl/Nombre: se sube primero con
  // POST /autorizaciones-salida/adjuntos (multer, ver el controller) y se
  // referencia aquí por URL — opcional, no todas las autorizaciones llevan
  // evidencia adjunta.
  @IsOptional()
  @IsString()
  evidenciaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  evidenciaNombre?: string;
}
