#!/usr/bin/env node
/**
 * Herramienta de DESARROLLO para la Fase 1 del licenciamiento de AsistSCA.
 *
 * Firma a mano un token de licencia ES256 para un fingerprint de servidor
 * específico, usando la llave PRIVADA de prueba (nunca se sube a git — ver
 * .gitignore). Esto simula lo que en Fase 2 hará automáticamente el servidor
 * de licencias real de SCA.
 *
 * Uso:
 *   node storage/licencia/emitir-token-prueba.js \
 *     --fingerprint <valor-que-devuelve-GET-/licencia/estado> \
 *     --llave-privada ./private-key-test.pem \
 *     --cliente "Colegio Ejemplo" \
 *     --plan estandar \
 *     --salida storage/licencia/license.jwt
 *
 * Solo --fingerprint y --llave-privada son obligatorios. Toda licencia de
 * AsistSCA dura 1 año (8760 horas) por defecto — es la duración estándar
 * comercial acordada, no un valor de prueba. Para un caso puntual que
 * necesite otra duración, se puede pasar --horas explícitamente (ej. una
 * prueba piloto corta), pero el estándar para clientes reales es no pasarlo
 * y dejar que use el año completo.
 */
const crypto = require('crypto');
const fs = require('fs');

function leerArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const clave = argv[i].replace(/^--/, '');
    args[clave] = argv[i + 1];
  }
  return args;
}

function base64url(buffer) {
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function firmarJwtEs256(payload, privateKeyPem) {
  const header = { alg: 'ES256', typ: 'JWT' };
  const encabezado = base64url(Buffer.from(JSON.stringify(header)));
  const cuerpo = base64url(Buffer.from(JSON.stringify(payload)));
  const datosAFirmar = `${encabezado}.${cuerpo}`;

  const firma = crypto.sign('sha256', Buffer.from(datosAFirmar), {
    key: privateKeyPem,
    dsaEncoding: 'ieee-p1363',
  });

  return `${datosAFirmar}.${base64url(firma)}`;
}

function main() {
  const args = leerArgs();

  if (!args.fingerprint || !args['llave-privada']) {
    console.error('Faltan argumentos obligatorios: --fingerprint y --llave-privada');
    console.error('Ver el comentario al inicio de este archivo para el uso completo.');
    process.exit(1);
  }

  const privateKeyPem = fs.readFileSync(args['llave-privada'], 'utf8');
  // Duración estándar comercial de toda licencia de AsistSCA: 1 año.
  // --horas queda disponible solo para casos puntuales (ej. una prueba piloto
  // corta) que necesiten un vencimiento distinto.
  const HORAS_POR_DEFECTO_UN_ANIO = 365 * 24;
  const horas = args.horas ? parseInt(args.horas, 10) : HORAS_POR_DEFECTO_UN_ANIO;
  const ahora = Math.floor(Date.now() / 1000);

  const payload = {
    cliente: args.cliente ?? 'CLIENTE-DE-PRUEBA',
    plan: args.plan ?? 'estandar',
    limites: { maxEstudiantes: 500, maxLectoresNfc: 10 },
    modulos: ['asistencia', 'nfc', 'reportes', 'whatsapp'],
    fingerprint: args.fingerprint,
    iat: ahora,
    exp: ahora + horas * 60 * 60,
  };

  const token = firmarJwtEs256(payload, privateKeyPem);

  if (args.salida) {
    fs.writeFileSync(args.salida, token, 'utf8');
    console.log(`Token escrito en ${args.salida}`);
  } else {
    console.log(token);
  }
}

main();
