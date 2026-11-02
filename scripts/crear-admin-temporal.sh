#!/bin/bash
# Script TEMPORAL para crear el primer usuario admin en un despliegue
# nuevo -- el sistema no trae ningun admin de fabrica ni endpoint publico
# para crear el primero (crear usuarios ya requiere estar logueado), asi
# que esto inserta directo en la base de datos una sola vez.
#
# Uso: correr desde la carpeta ~/asistsca (donde esta docker-compose.yml),
# con los contenedores ya levantados (backend y postgres healthy):
#
#   bash asistsca-backend/scripts/crear-admin-temporal.sh
#
# Es un parche manual -- una vez que confirmes que el login funciona,
# crea tu usuario real desde el panel (logueado como admin) y borra este
# usuario de prueba. Este archivo tambien se puede borrar del repo
# despues (ver aviso al usuario en el chat de Claude).

set -e
cd ~/asistsca

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
echo "Es un usuario de PRUEBA del despliegue -- cambia la contraseña o"
echo "crea tu usuario real y borra este desde el panel una vez que"
echo "confirmes que todo funciona."
