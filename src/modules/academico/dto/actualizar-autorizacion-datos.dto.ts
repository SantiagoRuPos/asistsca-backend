import { IsBoolean } from 'class-validator';

// (2026-10-15) DTO para registrar la autorizacion de tratamiento de datos
// personales (Ley 1581 de 2012 / Habeas Data) que un acudiente otorga en
// representacion del menor. El colegio es el responsable del tratamiento
// y es quien recoge el consentimiento real (en papel o en el formulario
// que publique) -- este endpoint solo deja la constancia en el sistema.
export class ActualizarAutorizacionDatosDto {
  @IsBoolean()
  autorizado!: boolean;
}
