import { IsNotEmpty, IsUUID } from 'class-validator';

export class CambiarCursoEstudianteDto {
  @IsUUID()
  @IsNotEmpty()
  cursoId!: string;
}
