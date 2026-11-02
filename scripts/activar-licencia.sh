#!/bin/bash
# Activa/renueva la licencia de este despliegue (Fase 1, manual -- ver
# arquitectura/plan-licenciamiento.md). Dos pasos, dos sub-comandos:
#
#   1. Ver el fingerprint de este servidor:
#      bash scripts/activar-licencia.sh ver <email-admin> <password-admin>
#
#   2. Firmar e instalar el token (requiere la llave privada de produccion,
#      que SOLO vive en el gestor de contraseñas -- nunca se pega en un
#      chat, ni siquiera con Claude, ver incidente-2026-09-23 en el
#      proyecto):
#      bash scripts/activar-licencia.sh firmar <fingerprint> <ruta-llave-privada-temporal> "<cliente>" [plan]
#
# Correr desde cualquier lado dentro del repo -- el script encuentra solo
# la carpeta ~/asistsca (donde vive docker-compose.yml).

set -e

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

SUBCOMANDO="$1"

if [ "$SUBCOMANDO" = "ver" ]; then
  EMAIL="$2"
  PASSWORD="$3"
  if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
    echo "Uso: bash scripts/activar-licencia.sh ver <email-admin> <password-admin>"
    exit 1
  fi

  RESPUESTA=$(curl -s -X POST http://localhost/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

  ACCESS_TOKEN=$(echo "$RESPUESTA" | grep -oP '"accessToken":"\K[^"]+' || true)
  if [ -z "$ACCESS_TOKEN" ]; then
    echo "No se pudo iniciar sesion. Respuesta del servidor:"
    echo "$RESPUESTA"
    exit 1
  fi

  echo "--- Estado actual de la licencia ---"
  curl -s http://localhost/api/licencia/estado -H "Authorization: Bearer $ACCESS_TOKEN" | python3 -m json.tool
  echo ""
  echo "Copia el valor de \"fingerprintServidor\" de arriba para el paso 'firmar'."

elif [ "$SUBCOMANDO" = "firmar" ]; then
  FINGERPRINT="$2"
  LLAVE_PRIVADA="$3"
  CLIENTE="$4"
  PLAN="${5:-estandar}"

  if [ -z "$FINGERPRINT" ] || [ -z "$LLAVE_PRIVADA" ] || [ -z "$CLIENTE" ]; then
    echo "Uso: bash scripts/activar-licencia.sh firmar <fingerprint> <ruta-llave-privada-temporal> \"<cliente>\" [plan]"
    exit 1
  fi

  if [ ! -f "$LLAVE_PRIVADA" ]; then
    echo "No existe el archivo de llave privada: $LLAVE_PRIVADA"
    exit 1
  fi

  echo "--- Copiando la llave privada al contenedor (temporal) ---"
  sudo docker compose cp "$LLAVE_PRIVADA" backend:/app/storage/licencia/private-key-temp.pem

  echo "--- Firmando el token ---"
  sudo docker compose exec backend node storage/licencia/emitir-token-prueba.js \
    --fingerprint "$FINGERPRINT" \
    --llave-privada storage/licencia/private-key-temp.pem \
    --cliente "$CLIENTE" \
    --plan "$PLAN" \
    --salida storage/licencia/license.jwt

  echo "--- Borrando la llave privada del contenedor y del host ---"
  sudo docker compose exec backend rm -f storage/licencia/private-key-temp.pem
  rm -f "$LLAVE_PRIVADA"
  echo "Llave privada borrada de: $LLAVE_PRIVADA (y del contenedor)."

  echo "--- Esperando a que el caché interno (60s) recoja el token nuevo ---"
  sleep 61

  echo "--- Para confirmar, corre: bash scripts/activar-licencia.sh ver <email-admin> <password-admin> ---"
  echo "Debe mostrar \"nivel\": \"activa\"."

else
  echo "Uso:"
  echo "  bash scripts/activar-licencia.sh ver <email-admin> <password-admin>"
  echo "  bash scripts/activar-licencia.sh firmar <fingerprint> <ruta-llave-privada-temporal> \"<cliente>\" [plan]"
  exit 1
fi
