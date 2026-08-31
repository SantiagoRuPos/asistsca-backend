import { IsNotEmpty, IsString } from 'class-validator';

export class RegistrarEventoDto {
  @IsString() @IsNotEmpty()
  id_tarjeta!: string;

  @IsString() @IsNotEmpty()
  id_lector!: string;
}