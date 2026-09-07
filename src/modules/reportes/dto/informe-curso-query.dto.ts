import { IsDateString, IsUUID } from 'class-validator';

export class InformeCursoQueryDto {
  @IsUUID()
  cursoId!: string;

  @IsDateString({}, { message: 'fechaInicio debe tener formato YYYY-MM-DD' })
  fechaInicio!: string;

  @IsDateString({}, { message: 'fechaFin debe tener formato YYYY-MM-DD' })
  fechaFin!: string;
}
