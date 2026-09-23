import { Type } from 'class-transformer';
import { IsInt, IsMilitaryTime, IsOptional, Max, Min } from 'class-validator';

// Todos los campos opcionales: se puede corregir solo la hora de entrada, solo
// la tolerancia, etc., sin tener que reenviar los tres — el mismo patrón que
// ActualizarEstudianteDto/ActualizarAcudienteDto en este mismo módulo.
export class ActualizarHorarioCursoDto {
  @IsOptional()
  @IsMilitaryTime({ message: 'horaEntrada debe tener formato HH:mm' })
  horaEntrada?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  minutosToleranciaTardanza?: number;

  @IsOptional()
  @IsMilitaryTime({ message: 'horaSalida debe tener formato HH:mm' })
  horaSalida?: string;
}
