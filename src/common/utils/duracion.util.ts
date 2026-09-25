/**
 * Convierte una duración estilo JWT ("15m", "7d", "30s", "2h") a milisegundos.
 * Se usa tanto para calcular la expiración del refresh token guardado en BD
 * (auth.service.ts) como para la duración de la cookie httpOnly que lo
 * transporta (auth.controller.ts) — un único parser evita que ambos se
 * desincronicen si algún día cambia el formato de JWT_REFRESH_EXPIRES_IN.
 */
export function parsearDuracionMs(duracion: string): number {
  const match = /^(\d+)([smhd])$/.exec(duracion);
  if (!match) throw new Error(`Formato de duración inválido: ${duracion}`);
  const multiplicadores: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(match[1], 10) * multiplicadores[match[2]];
}
