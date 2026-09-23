import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Fingerprint del servidor para licenciamiento.
 *
 * Antes incluía también la MAC de la tarjeta de red, pero dentro de Docker
 * esa MAC puede cambiar entre reinicios del mismo contenedor (reconexión de
 * red), lo que invalidaba la licencia sin que nada externo cambiara. Se
 * dejó solo el machineId, que sí es estable para el mismo contenedor/VPS.
 */
export function calcularFingerprintServidor(): string {
  const machineId = obtenerMachineId();
  return crypto.createHash('sha256').update(machineId).digest('hex');
}

function obtenerMachineId(): string {
  try {
    return fs.readFileSync('/etc/machine-id', 'utf8').trim();
  } catch {
    return `hostname:${os.hostname()}`;
  }
}
