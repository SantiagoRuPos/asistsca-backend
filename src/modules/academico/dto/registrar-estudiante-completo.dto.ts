import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Parentesco } from '../../../config/entities/academico/acudiente.entity';

class EstudianteDatosDto {
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
}

class MatriculaDatosDto {
  @IsUUID() @IsNotEmpty()
  cursoId!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  anioLectivo?: number;
}

class AcudienteDatosDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  nombres!: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  apellidos!: string;

  @IsEnum(Parentesco, { message: 'parentesco debe ser padre, madre, tutor u otro' })
  parentesco!: Parentesco;

  @IsString() @IsNotEmpty() @MaxLength(30)
  telefonoWhatsapp!: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(30)
  numeroDocumento?: string;
}

export class RegistrarEstudianteCompletoDto {
  @ValidateNested()
  @Type(() => EstudianteDatosDto)
  estudiante!: EstudianteDatosDto;

  @ValidateNested()
  @Type(() => MatriculaDatosDto)
  matricula!: MatriculaDatosDto;

  @ValidateNested()
  @Type(() => AcudienteDatosDto)
  acudiente!: AcudienteDatosDto;
}
