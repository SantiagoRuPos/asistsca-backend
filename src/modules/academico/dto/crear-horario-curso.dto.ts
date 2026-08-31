import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsMilitaryTime, IsOptional, Max, Min } from 'class-validator';

export class CrearHorarioCursoDto {
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  @ArrayMinSize(1)
  diasSemana!: number[]; // ej: [1,2,3,4,5] = lunes a viernes

  @IsMilitaryTime({ message: 'horaEntrada debe tener formato HH:mm' })
  horaEntrada!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  minutosToleranciaTardanza?: number;

  @IsMilitaryTime({ message: 'horaSalida debe tener formato HH:mm' })
  horaSalida!: string;
}