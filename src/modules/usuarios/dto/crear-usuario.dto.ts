import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CrearUsuarioDto {
  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(150)
  email!: string;

  @IsString()
  @MinLength(10, { message: 'La contraseña debe tener al menos 10 caracteres' })
  @MaxLength(72)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+/, {
    message: 'La contraseña debe incluir mayúscula, minúscula, número y símbolo',
  })
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombreCompleto!: string;
}