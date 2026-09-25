import { IsUUID } from 'class-validator';

// Siempre actúa sobre el registro de HOY (fecha implícita, igual criterio
// que las acciones de un solo clic en Carnets) -- deshacer un registro de
// otro día no es el caso de uso real ("me equivoqué de estudiante ahorita").
export class DeshacerRegistroManualDto {
  @IsUUID()
  estudianteId!: string;
}
