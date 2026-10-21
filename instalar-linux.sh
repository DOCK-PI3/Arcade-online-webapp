#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$project_root"
check_only=0
skip_system_deps=0
for option in "$@"; do
  case "$option" in
    --check) check_only=1 ;;
    --skip-system-deps) skip_system_deps=1 ;;
    --help|-h)
      echo 'Uso: bash instalar-linux.sh [--check] [--skip-system-deps]'
      echo 'Instala Node 24, paquetes npm, EmulatorJS y Chromium; compila la web.'
      echo '--check: comprueba lo instalado sin descargar ni cambiar archivos.'
      echo '--skip-system-deps: omite los paquetes del sistema de Chromium (si ya estan instalados).'
      exit 0 ;;
    *) echo "Opcion desconocida: $option" >&2; exit 2 ;;
  esac
done
[[ "$(uname -s)" == Linux ]] || { echo 'Este instalador es para Linux.' >&2; exit 1; }
[[ "$EUID" -ne 0 ]] || { echo 'Ejecuta como usuario normal. Playwright pedira sudo solo para los paquetes del sistema.' >&2; exit 1; }
node_version=24.15.0
# SHA-256: https://nodejs.org/dist/v24.15.0/SHASUMS256.txt
case "$(uname -m)" in
  x86_64) node_arch=x64; node_hash=472655581fb851559730c48763e0c9d3bc25975c59d518003fc0849d3e4ba0f6 ;;
  aarch64|arm64) node_arch=arm64; node_hash=f3d5a797b5d210ce8e2cb265544c8e482eaedcb8aa409a8b46da7e8595d0dda0 ;;
  *) echo 'Arquitectura no compatible: se requiere Linux x64 o ARM64.' >&2; exit 1 ;;
esac
portable_bin="$project_root/.cache/node/node-v$node_version-linux-$node_arch/bin"
[[ ! -x "$portable_bin/node" ]] || export PATH="$portable_bin:$PATH"
node_ok() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 &&
    node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a===24 && b>=15 ? 0 : 1)'
}
if ! node_ok; then
  [[ "$check_only" == 0 ]] || { echo 'Falta Node.js 24.15 o posterior de la rama 24. Ejecuta bash instalar-linux.sh.' >&2; exit 1; }
  for tool in tar xz sha256sum; do
    command -v "$tool" >/dev/null 2>&1 || { echo "Falta $tool. Instala tar, xz-utils y ca-certificates con el gestor de tu distribucion." >&2; exit 1; }
  done
  mkdir -p -- "$project_root/.cache/node"
  node_archive="$project_root/.cache/node/node-v$node_version-linux-$node_arch.tar.xz"
  node_url="https://nodejs.org/dist/v$node_version/node-v$node_version-linux-$node_arch.tar.xz"
  echo "Descargando Node.js $node_version desde nodejs.org..."
  if command -v curl >/dev/null 2>&1; then
    curl --fail --location --retry 3 --connect-timeout 30 --max-time 300 "$node_url" --output "$node_archive.partial"
  elif command -v wget >/dev/null 2>&1; then
    wget --timeout=30 --tries=3 -O "$node_archive.partial" "$node_url"
  else
    echo 'Instala curl o wget y ca-certificates para descargar Node.js.' >&2; exit 1
  fi
  printf '%s  %s\n' "$node_hash" "$node_archive.partial" | sha256sum --check --status || { echo 'El hash de Node.js no coincide.' >&2; exit 1; }
  mv -- "$node_archive.partial" "$node_archive"
  tar -xJf "$node_archive" -C "$project_root/.cache/node"
  export PATH="$portable_bin:$PATH"
  node_ok || { echo 'No se pudo preparar Node.js.' >&2; exit 1; }
fi
if [[ "$check_only" == 1 ]]; then
  exec node --env-file-if-exists=.env scripts/setup-server.mjs check
elif [[ "$skip_system_deps" == 1 ]]; then
  exec node --env-file-if-exists=.env scripts/setup-server.mjs install --skip-system-deps
else
  exec node --env-file-if-exists=.env scripts/setup-server.mjs install
fi
