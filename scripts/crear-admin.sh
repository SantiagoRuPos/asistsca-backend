#!/bin/bash
# Respaldo manual para crear el primer admin -- normalmente NO hace falta
# correr esto: si pones ADMIN_EMAIL y ADMIN_PASSWORD en el .env, el backend
# crea ese usuario solo al arrancar (ver src/config/database/admin-seeder.service.ts).
# Usa este script solo si prefieres no poner esas variables en el .env, o si
# necesitas crear un admin adicional por SQL directo.
#
# Uso: desde ~/asistsca (o cualquier subcarpeta del repo), con los
# contenedores ya levantados (backend y postgres healthy):
#   bash asistsca-backend/scripts/crear-admin.sh

set -e
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RAIZ"

ADMIN_EMAIL='admin@asistsca.local'
ADMIN_PASSWORD='CambiaEsta123!'

HASH=$(sudo docker compose exec -T backend node -e "require('bcrypt').hash(process.argv[1], 12).then(h => process.stdout.write(h))" "$ADMIN_PASSWORD")

if [ -z "$HASH" ]; then
  echo "ERROR: no se pudo generar el hash -- revisa que el contenedor 'backend' este healthy (sudo docker compose ps)."
  exit 1
fi

sudo docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<SQL
INSERT INTO roles (id, nombre, descripcion)
SELECT gen_random_uuid(), 'admin', 'Administrador del sistema'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE nombre = 'admin');

INSERT INTO estados (id, categoria, codigo, nombre, descripcion)
SELECT gen_random_uuid(), 'usuario', 'activo', 'Activo', 'Usuario activo'
WHERE NOT EXISTS (SELECT 1 FROM estados WHERE categoria = 'usuario' AND codigo = 'activo');

INSERT INTO usuarios (id, email, password_hash, nombre_completo, rol_id, estado_id, debe_cambiar_password)
SELECT gen_random_uuid(), '$ADMIN_EMAIL', '$HASH', 'Administrador', r.id, e.id, false
FROM roles r, estados e
WHERE r.nombre = 'admin' AND e.categoria = 'usuario' AND e.codigo = 'activo'
AND NOT EXISTS (SELECT 1 FROM usuarios WHERE email = '$ADMIN_EMAIL');
SQL

echo ""
echo "=================================================="
echo "Usuario admin listo para probar:"
echo "  Email:    $ADMIN_EMAIL"
echo "  Password: $ADMIN_PASSWORD"
echo "=================================================="
echo "Cambia la contraseña o crea tu usuario real desde el panel y borra"
echo "este una vez que confirmes que todo funciona."
