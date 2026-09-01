import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Roles administrables desde la pantalla de Usuarios del panel.
// "profesor" queda fuera a proposito: ese rol se crea desde Academico > Nuevo
// profesor, porque ahi si se registran los datos academicos (documento,
// materias, curso, etc.) que un profesor real necesita. Crear un profesor
// "suelto" desde aqui dejaria un Usuario sin Profesor asociado.
const ROLES_REGISTRABLES = ['admin', 'rector', 'coordinador'] as const;

export class RegistrarUsuarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombreCompleto!: string;

  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(150)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsIn(ROLES_REGISTRABLES, { message: 'El rol debe ser admin, rector o coordinador' })
  rol!: (typeof ROLES_REGISTRABLES)[number];
}
