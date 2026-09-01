import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearProfesorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombres!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  apellidos!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  numeroDocumento!: string;

  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(150)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  // La contraseña temporal ya no la escribe quien registra al profesor: se
  // genera en el backend (AcademicoService.crearProfesor) y se envía por
  // correo, con el mismo patrón que UsuariosService.registrar(). Antes este
  // campo era obligatorio en el DTO — se quitó junto con esa validación.
}
