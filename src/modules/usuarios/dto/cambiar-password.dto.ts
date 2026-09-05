import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CambiarPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Debes indicar tu contraseña actual.' })
  passwordActual!: string;

  // Misma política de complejidad que ya exigen CrearUsuarioDto y la
  // contraseña temporal generada por generarPasswordTemporal(), para no
  // introducir una regla nueva ni distinta.
  @IsString()
  @MinLength(10, { message: 'La contraseña debe tener al menos 10 caracteres' })
  @MaxLength(72)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+/, {
    message: 'La contraseña debe incluir mayúscula, minúscula, número y símbolo',
  })
  passwordNueva!: string;
}
