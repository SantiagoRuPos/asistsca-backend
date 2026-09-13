import { createHash } from 'crypto';
import { networkInterfaces, hostname } from 'os';
import { readFileSync } from 'fs';

/**
 * Calcula el "fingerprint" (huella) de este servidor: identifica la máquina
 * física/VM donde corre el backend para que un token de licencia emitido
 * para un cliente no se pueda copiar tal cual a otro servidor.
 *
 * fingerprint = SHA-256( machineId + ":" + macPrincipal )
 *
 * - machineId: en Linux se lee de /etc/machine-id (id estable generado por
 *   systemd/dbus al instalar el SO, no cambia entre reinicios). Si no existe
 *   (ej. contenedor sin systemd, u otro SO), se usa hostname() como respaldo
 *   — MENOS estable que machine-id, así que si el hostname del servidor
 *   cambia, el fingerprint también cambiará y habrá que reautorizar. Esto es
 *   una limitación conocida de Fase 1, documentada para revisarla si el
 *   cliente despliega en Windows Server o en un contenedor efímero.
 * - macPrincipal: la primera MAC física no interna que se encuentre (se
 *   descartan loopback y interfaces virtuales sin MAC).
 *
 * Determinístico: mismas entradas → mismo fingerprint siempre, sin persistir
 * nada por sí solo (la "sellada" en la fila de licencia_estado es cosa del
 * LicenciaTokenService, no de esta función).
 */
export function calcularFingerprintServidor(): string {
  const machineId = obtenerMachineId();
  const mac = obtenerMacPrincipal();
  const base = `${machineId}:${mac}`;
  return createHash('sha256').update(base).digest('hex');
}

function obtenerMachineId(): string {
  try {
    return readFileSync('/etc/machine-id', 'utf8').trim();
  } catch {
    // Respaldo si /etc/machine-id no existe (no es Linux, o no tiene systemd).
    return `hostname:${hostname()}`;
  }
}

function obtenerMacPrincipal(): string {
  const interfaces = networkInterfaces();
  const direcciones = Object.values(interfaces).flat();

  for (const dir of direcciones) {
    if (!dir) continue;
    if (dir.internal) continue;
    if (!dir.mac || dir.mac === '00:00:00:00:00:00') continue;
    return dir.mac.toLowerCase();
  }

  // No debería pasar en un servidor real con red — si pasa, el fingerprint
  // queda basado solo en machineId (menos único, pero no rompe el arranque).
  return 'sin-mac-detectada';
}
