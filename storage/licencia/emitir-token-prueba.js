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
 *
 * Antes de firmar, el script valida que --llave-privada sea de verdad una
 * llave privada EC (no cualquier otro texto pegado por error — esto pasó de
 * verdad el 2026-09-23: se pegó por accidente un comando de PowerShell en
 * vez de la llave) y, si existe storage/licencia/public-key.pem al lado de
 * este script, confirma que esa llave privada corresponde exactamente a esa
 * pública antes de continuar. Usa --forzar para saltarte esta segunda
 * comprobación (ej. si a propósito estás firmando con una llave de prueba
 * distinta a la de producción).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

/**
 * Verifica que el texto dado sea realmente una llave privada EC P-256 válida.
 * Si no lo es (por ejemplo, si alguien pegó por error otra cosa, como pasó el
 * 2026-09-23), falla con un mensaje claro en vez de un error críptico de
 * OpenSSL más adelante.
 */
function validarLlavePrivadaEc(privateKeyPem, rutaOriginal) {
  let keyObject;
  try {
    keyObject = crypto.createPrivateKey({ key: privateKeyPem, format: 'pem' });
  } catch (error) {
    console.error(`\nEl archivo "${rutaOriginal}" no contiene una llave privada válida.`);
    console.error(`Detalle: ${(error).message}`);
    console.error('¿Copiaste de verdad la llave privada desde el gestor de contraseñas, y no otra cosa (un comando, un texto del chat, etc.)?\n');
    process.exit(1);
  }

  if (keyObject.asymmetricKeyType !== 'ec') {
    console.error(`\nEl archivo "${rutaOriginal}" es una llave privada, pero de tipo "${keyObject.asymmetricKeyType}", no EC (se esperaba ECDSA P-256).\n`);
    process.exit(1);
  }

  const curva = keyObject.asymmetricKeyDetails && keyObject.asymmetricKeyDetails.namedCurve;
  if (curva && curva !== 'prime256v1') {
    console.error(`\nLa llave privada en "${rutaOriginal}" usa la curva "${curva}", no "prime256v1" (P-256) como espera AsistSCA.\n`);
    process.exit(1);
  }

  return keyObject;
}

/**
 * Si existe storage/licencia/public-key.pem junto a este script, confirma
 * que la llave privada dada corresponde exactamente a esa pública — evita
 * firmar (y entregar) un token con la llave equivocada sin darse cuenta.
 */
function validarCoincideConPublicaDelProyecto(keyObject, forzar) {
  const rutaPublica = path.join(__dirname, 'public-key.pem');
  if (!fs.existsSync(rutaPublica)) {
    return; // Nada que comparar (ej. entorno nuevo sin llave pública todavía).
  }

  const publicaDelProyecto = fs.readFileSync(rutaPublica, 'utf8').replace(/\r\n/g, '\n').trim();
  const publicaDerivada = crypto.createPublicKey(keyObject).export({ type: 'spki', format: 'pem' }).replace(/\r\n/g, '\n').trim();

  if (publicaDelProyecto !== publicaDerivada) {
    console.error(`\nLa llave privada que diste NO corresponde a "storage/licencia/public-key.pem" de este proyecto.`);
    console.error('Un token firmado así nunca vería el backend como válido (el guard lo rechazaría igual que un token sin firmar).');
    console.error('Si esto es intencional (ej. una prueba con otra llave), volvé a correr con --forzar.\n');
    if (!forzar) {
      process.exit(1);
    }
    console.error('(--forzar activo: continuando de todas formas.)\n');
  }
}

function main() {
  const args = leerArgs();

  if (!args.fingerprint || !args['llave-privada']) {
    console.error('Faltan argumentos obligatorios: --fingerprint y --llave-privada');
    console.error('Ver el comentario al inicio de este archivo para el uso completo.');
    process.exit(1);
  }

  const privateKeyPem = fs.readFileSync(args['llave-privada'], 'utf8');
  const keyObject = validarLlavePrivadaEc(privateKeyPem, args['llave-privada']);
  validarCoincideConPublicaDelProyecto(keyObject, Boolean(args.forzar));

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
