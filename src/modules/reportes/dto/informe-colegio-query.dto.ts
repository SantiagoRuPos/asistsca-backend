import { IsDateString } from 'class-validator';

export class InformeColegioQueryDto {
  @IsDateString({}, { message: 'fechaInicio debe tener formato YYYY-MM-DD' })
  fechaInicio!: string;

  @IsDateString({}, { message: 'fechaFin debe tener formato YYYY-MM-DD' })
  fechaFin!: string;
}
