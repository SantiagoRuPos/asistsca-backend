import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CambiarTarjetaEstudianteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  uidTarjeta!: string;
}
