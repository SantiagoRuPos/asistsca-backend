import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITMO = 'aes-256-gcm';

function obtenerClave(secreto: string): Buffer {
  return scryptSync(secreto, 'asistsca-cifrado-salt', 32);
}

export function cifrar(texto: string, secreto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, obtenerClave(secreto), iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, cifrado]).toString('base64');
}

export function descifrar(textoCifrado: string, secreto: string): string {
  const datos = Buffer.from(textoCifrado, 'base64');
  const iv = datos.subarray(0, 12);
  const authTag = datos.subarray(12, 28);
  const cifrado = datos.subarray(28);
  const decipher = createDecipheriv(ALGORITMO, obtenerClave(secreto), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8');
}