import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Parentesco } from '../../../config/entities/academico/acudiente.entity';

// Igual que CrearAcudienteDto pero con todos los campos opcionales — una
// edición típica solo corrige el WhatsApp o el email, no reescribe todo.
export class ActualizarAcudienteDto {
  @IsOptional() @IsString() @MaxLength(120)
  nombre?: string;

  @IsOptional() @IsString() @MaxLength(120)
  apellidos?: string;

  @IsOptional() @IsEnum(Parentesco, { message: 'parentesco debe ser padre, madre, tutor u otro' })
  parentesco?: Parentesco;

  @IsOptional() @IsString() @MaxLength(30)
  telefonoWhatsapp?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(30)
  numeroDocumento?: string;
}
