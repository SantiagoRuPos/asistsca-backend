import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

// Vincula un acudiente que YA EXISTE a un estudiante adicional -- el caso
// real de hermanos o sobrinos que comparten el mismo acudiente, sin
// duplicar sus datos de contacto creando un registro nuevo por cada uno.
export class VincularAcudienteExistenteDto {
  @IsUUID()
  estudianteId!: string;

  // Por defecto queda como contacto de notificación (igual que cuando se
  // vincula al crear el acudiente por primera vez) -- se puede desmarcar
  // después desde la misma pantalla si no aplica para este estudiante.
  @IsOptional()
  @IsBoolean()
  esContactoNotificacion?: boolean;
}
