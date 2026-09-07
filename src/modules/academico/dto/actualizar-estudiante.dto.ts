import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

enum EstadoEstudianteDto {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
}

// Todos los campos opcionales — una edición típica solo corrige un dato
// puntual (ej. el número de documento estaba mal digitado), no reescribe
// todo el registro. El cambio de curso y el cambio de carnet NFC van por
// endpoints aparte (cambiarCursoEstudiante / NfcService.cambiarTarjetaEstudiante)
// porque tocan otras tablas (matrículas, tarjetas) con su propia lógica de
// negocio, no son columnas simples de "estudiantes".
export class ActualizarEstudianteDto {
  @IsOptional() @IsString() @MaxLength(120)
  nombres?: string;

  @IsOptional() @IsString() @MaxLength(120)
  apellidos?: string;

  @IsOptional() @IsString() @MaxLength(20)
  tipoDocumento?: string;

  @IsOptional() @IsString() @MaxLength(30)
  numeroDocumento?: string;

  @IsOptional() @IsDateString({}, { message: 'fechaNacimiento debe tener formato YYYY-MM-DD' })
  fechaNacimiento?: string;

  @IsOptional() @IsEnum(EstadoEstudianteDto, { message: 'estadoCodigo debe ser activo o inactivo' })
  estadoCodigo?: EstadoEstudianteDto;
}
