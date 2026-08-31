import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Parentesco } from '../../../config/entities/academico/acudiente.entity';

export class CrearAcudienteDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  nombre!: string;

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

  // Si se manda, vincula de una vez este acudiente a ese estudiante.
  @IsOptional() @IsUUID()
  estudianteId?: string;
}