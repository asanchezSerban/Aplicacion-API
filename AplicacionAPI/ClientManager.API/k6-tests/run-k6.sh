#!/usr/bin/env bash
# Wrapper para k6 que carga las variables de local.config.env automáticamente.
# Uso: ./run-k6.sh test-carga-normal.js
#      ./run-k6.sh test-pico.js
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$DIR/local.config.env"

if [ ! -f "$CONFIG" ]; then
  echo "Error: $CONFIG no encontrado."
  echo "Crea el fichero copiando el ejemplo y rellena los valores."
  exit 1
fi

# Cargar variables ignorando comentarios y líneas vacías
set -a
# shellcheck source=/dev/null
source <(grep -v '^\s*#' "$CONFIG" | grep -v '^\s*$')
set +a

# Construir argumentos -e para k6
K6_ARGS=(
  "-e" "TEST_EMAIL=${SUPERADMIN_EMAIL}"
  "-e" "TEST_PASSWORD=${SUPERADMIN_PASSWORD}"
  "-e" "MFA_TYPE=totp"
  "-e" "TOTP_SECRET=${TOTP_SECRET}"
  "-e" "API_URL=${API_URL}"
  "-e" "SMTP4DEV_URL=${SMTP4DEV_URL}"
)

echo "Ejecutando: k6 run ${K6_ARGS[*]} $*"
k6 run "${K6_ARGS[@]}" "$@"
