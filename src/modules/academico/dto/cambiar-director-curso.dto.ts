import { IsNotEmpty, IsUUID } from 'class-validator';

export class CambiarDirectorCursoDto {
  @IsUUID()
  @IsNotEmpty()
  profesorDirectorId!: string;
}