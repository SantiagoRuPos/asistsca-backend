# Licenciamiento — Fase 1

Esta carpeta guarda los archivos que usa el módulo de licenciamiento
(`src/modules/licenciamiento/`) para verificar que este servidor tiene una
licencia de AsistSCA vigente.

## Archivos

- `public-key.pem` — llave PÚBLICA ECDSA P-256 **de producción** (reemplazó
  a la llave de prueba original el 2026-09-11, antes de que existiera
  cualquier cliente real, precisamente para no dejar en producción una llave
  cuya privada hubiera pasado por un chat de desarrollo). **Sí se sube a
  git**: no es secreta, es lo que este backend usa para *verificar* la firma
  de un token de licencia. Sin ella el proyecto ni siquiera arranca.
- `license.jwt` — el token de licencia vigente de ESTE servidor. **NUNCA se
  sube a git** (ver `.gitignore`): es específico de cada cliente/instalación.
  No existe hasta que se genera uno (ver flujo abajo).
- `emitir-token-prueba.js` — script para firmar tokens de licencia a mano con
  la llave privada (de producción o de prueba, según cuál se le pase con
  `--llave-privada`). Simula lo que en Fase 2 hará automáticamente el
  servidor de licencias real de SCA.

## Llave privada

La llave PRIVADA correspondiente a `public-key.pem` **no está en este
repositorio a propósito**. Se guarda fuera de git (ej. gestor de
contraseñas), nunca en una carpeta sincronizada al repo. Cualquier patrón
`*private*` dentro de esta carpeta ya queda ignorado por `.gitignore` como
red de seguridad adicional.

**Importante:** esta es la llave que firma licencias reales para clientes
pagando — es la única que debe usarse para emitir tokens de producción.
Existió una llave de PRUEBA anterior (generada al construir Fase 1, antes de
tener clientes) que ya no debe usarse para nada real: su privada circuló por
un chat de desarrollo, así que no es apta para proteger a un cliente real.
Puede seguirse usando solo para pruebas desechables si hace falta, nunca
para un `license.jwt` de un servidor real. En Fase 2, esta llave (o una
sucesora) vivirá exclusivamente en el servidor de licencias real de SCA y
jamás volverá a tocar el código ni los servidores de los clientes.

## Duración de una licencia

Toda licencia de AsistSCA dura **1 año** desde que se firma (`exp` = `iat` +
365 días) — es el estándar comercial acordado, no un valor de prueba.
`emitir-token-prueba.js` usa esto por defecto; solo hay que pasar `--horas`
explícitamente para un caso puntual que necesite otra duración (ej. una
prueba piloto corta). Cuando exista el servidor de licencias real (Fase 2),
la renovación automática (cada 6 horas, ver `licencia-renovacion.service.ts`)
reemplazará el token antes de que se acerque a vencer; en Fase 1, sin ese
servidor, el vencimiento a 1 año es principalmente una salvaguarda de que un
token nunca queda vigente "para siempre" sin que SCA vuelva a intervenir.

## Flujo para activar/renovar una licencia en Fase 1 (manual)

1. Desplegar este código y arrancar el backend. Sin `license.jwt`, el estado
   arranca en `aviso` (periodo de gracia desde el primer arranque).
2. Un administrador inicia sesión y llama `GET /licencia/estado`. La
   respuesta incluye `fingerprintServidor` — el identificador único de ESTE
   servidor.
3. Ese fingerprint se envía a SCA Solutions.
4. SCA firma un token con ese fingerprint exacto (con
   `emitir-token-prueba.js` mientras no exista el servidor de licencias real)
   y se lo entrega al cliente.
5. El cliente guarda ese token como `storage/licencia/license.jwt` en el
   servidor. **No hace falta reiniciar el backend**: el archivo se vuelve a
   leer solo la próxima vez que expire la caché interna de 60 segundos
   (`TTL_CACHE_MS` en `licencia-token.service.ts`), así que en menos de un
   minuto el estado ya refleja el token nuevo.
6. `GET /licencia/estado` debe mostrar `"nivel": "activa"`.

La Fase 2 (servidor de licencias real) automatizará los pasos 3-5 por HTTP;
por ahora son manuales a propósito, como pidió la instrucción de Fase 1.
