import { SetMetadata } from '@nestjs/common';

export const AUDITORIA_KEY = 'auditoria';

export interface MetadatosAuditoria {
  accion: string;
  entidad: string;
}

export const Auditar = (accion: string, entidad: string) =>
  SetMetadata(AUDITORIA_KEY, { accion, entidad } as MetadatosAuditoria);