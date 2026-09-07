import { IsDateString, IsUUID } from 'class-validator';

export class InformeEstudianteQueryDto {
  @IsUUID()
  estudianteId!: string;

  @IsDateString({}, { message: 'fechaInicio debe tener formato YYYY-MM-DD' })
  fechaInicio!: string;

  @IsDateString({}, { message: 'fechaFin debe tener formato YYYY-MM-DD' })
  fechaFin!: string;
}
