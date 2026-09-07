import { IsBoolean } from 'class-validator';

export class ActualizarContactoAcudienteDto {
  @IsBoolean()
  esContactoNotificacion!: boolean;
}
