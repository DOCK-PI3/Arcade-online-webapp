#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$project_root"
case "${1:-}" in
  --help|-h) echo 'Uso: bash iniciar-linux.sh [--check]'; echo 'Arranca el servidor en este equipo; respeta las opciones de .env. Detener: Ctrl+C.'; exit 0 ;;
  ''|--check) ;;
  *) echo "Opcion desconocida: $1" >&2; exit 2 ;;
esac
[[ $# -le 1 ]] || { echo 'Demasiados argumentos.' >&2; exit 2; }
[[ "$(uname -s)" == Linux ]] || { echo 'Este iniciador es para Linux.' >&2; exit 1; }
[[ "$EUID" -ne 0 ]] || { echo 'Ejecuta el servidor como usuario normal para usar el sandbox de Chromium.' >&2; exit 1; }
case "$(uname -m)" in
  x86_64) node_arch=x64 ;;
  aarch64|arm64) node_arch=arm64 ;;
  *) echo 'Arquitectura no compatible.' >&2; exit 1 ;;
esac
portable_bin="$project_root/.cache/node/node-v24.15.0-linux-$node_arch/bin"
[[ ! -x "$portable_bin/node" ]] || export PATH="$portable_bin:$PATH"
command -v node >/dev/null 2>&1 || { echo 'Primero ejecuta bash instalar-linux.sh.' >&2; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a===24 && b>=15 ? 0 : 1)' || { echo 'Se necesita Node 24.15 o posterior de la rama 24. Ejecuta bash instalar-linux.sh.' >&2; exit 1; }
node --env-file-if-exists=.env scripts/setup-server.mjs check
[[ "${1:-}" != --check ]] || exit 0
exec node --env-file-if-exists=.env server/index.js
