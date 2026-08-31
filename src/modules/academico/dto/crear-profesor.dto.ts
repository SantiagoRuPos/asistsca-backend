import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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

  @IsString()
  @MinLength(10, { message: 'La contraseña temporal debe tener al menos 10 caracteres' })
  @MaxLength(72)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+/, {
    message: 'La contraseña temporal debe incluir mayúscula, minúscula, número y símbolo',
  })
  passwordTemporal!: string;
}