import { randomInt } from 'crypto';

const MINUSCULAS = 'abcdefghijkmnopqrstuvwxyz';
const MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const NUMEROS = '23456789';
const SIMBOLOS = '!@#$%&*?';
const TODOS = MINUSCULAS + MAYUSCULAS + NUMEROS + SIMBOLOS;

function elegir(alfabeto: string): string {
  return alfabeto[randomInt(alfabeto.length)];
}

function mezclar(caracteres: string[]): string {
  const copia = [...caracteres];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.join('');
}

/**
 * Genera una contraseña temporal aleatoria que siempre cumple la misma
 * politica usada en los formularios (min 10 caracteres, mayuscula,
 * minuscula, numero y simbolo) para que el usuario nunca choque con la
 * validacion al iniciar sesion por primera vez.
 */
export function generarPasswordTemporal(longitud = 12): string {
  const obligatorios = [elegir(MAYUSCULAS), elegir(MINUSCULAS), elegir(NUMEROS), elegir(SIMBOLOS)];
  const restantes = Array.from({ length: Math.max(longitud - obligatorios.length, 0) }, () => elegir(TODOS));
  return mezclar([...obligatorios, ...restantes]);
}
