import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

export enum TipoRegistroManual {
  PRESENTE = 'presente',
  TARDE = 'tarde',
  AUSENTE = 'ausente',
  EXCUSADO = 'excusado',
  EVADIDO = 'evadido',
  SALIDA = 'salida',
  ENTRADA = 'entrada',
  // Revierte un "evadido" marcado por error, o porque el estudiante ya
  // apareció — ver AsistenciaService.registrarManual para la lógica.
  ENCONTRADO = 'encontrado',
}

export class RegistrarAsistenciaManualDto {
  @IsUUID()
  estudianteId!: string;

  @IsIn(Object.values(TipoRegistroManual))
  tipoRegistro!: TipoRegistroManual;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'hora debe tener formato HH:mm' })
  hora?: string;

  @IsString()
  @MinLength(4, { message: 'Describe brevemente el motivo del registro manual.' })
  observacion!: string;
}
