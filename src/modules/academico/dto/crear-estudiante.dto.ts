import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearEstudianteDto {
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