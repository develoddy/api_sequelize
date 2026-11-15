#!/usr/bin/env bash
set -Eeuo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info() { printf '\n%b%s%b\n' "$CYAN" "$*" "$NC"; }
fail() { printf '%bERROR: %s%b\n' "$RED" "$*" "$NC" >&2; exit 1; }
confirm() { local reply; read -r -p "$1 [s/N]: " reply; [[ "$reply" == 's' || "$reply" == 'S' ]]; }
trap 'printf "\n%bDespliegue interrumpido (línea %s).%b\n" "$RED" "$LINENO" "$NC" >&2' ERR

cd "$(dirname "${BASH_SOURCE[0]}")/.."
[[ "$(git branch --show-current)" == 'main' ]] || fail 'Debes estar en la rama main.'
[[ "$(git remote get-url origin)" == 'git@github.com:develoddy/api_sequelize.git' ]] || fail 'El remoto origin no es el SSH esperado.'

info '1. Verificar y publicar código local'
git fetch origin main
[[ -z "$(git rev-list HEAD..origin/main)" ]] || fail 'GitHub tiene commits que faltan en tu rama local. Sincroniza antes de desplegar.'

if [[ -n "$(git status --porcelain)" ]]; then
  git status --short
  confirm '¿Incluir TODOS los cambios locales en un commit?' || fail 'Cancelado por el usuario.'
  git add -A
  read -r -p 'Mensaje del commit: ' message
  [[ -n "$message" ]] || fail 'El mensaje no puede estar vacío.'
  git commit -m "$message"
fi

if [[ -n "$(git rev-list origin/main..HEAD)" ]]; then
  git log --oneline origin/main..HEAD
  confirm '¿Publicar estos commits en GitHub?' || fail 'Cancelado por el usuario.'
  git push origin main
fi

info '2. Confirmar actualización de producción'
local_sha="$(git rev-parse HEAD)"
printf 'Commit objetivo: %s\n' "$local_sha"
printf '%bAVISO: no se ejecutarán migraciones ni npm install.%b\n' "$YELLOW" "$NC"
confirm '¿Actualizar el código y reiniciar la API en producción?' || fail 'Cancelado por el usuario.'

info '3. Actualizar servidor con fast-forward'
ssh -o BatchMode=yes root@64.226.123.91 bash -se -- "$local_sha" <<'REMOTE'
set -Eeuo pipefail
expected="$1"
cd /var/www/api_sequelize
[[ "$(git branch --show-current)" == 'main' ]] || { echo 'ERROR: el servidor no está en main' >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo 'ERROR: hay cambios en el servidor; no se actualizará' >&2; git status --short; exit 1; }
git fetch origin main
[[ "$(git rev-parse origin/main)" == "$expected" ]] || { echo 'ERROR: origin/main no coincide con el commit confirmado' >&2; exit 1; }
git merge --ff-only origin/main
[[ "$(git rev-parse HEAD)" == "$expected" ]] || { echo 'ERROR: el commit desplegado no coincide' >&2; exit 1; }
REMOTE

info '4. Reiniciar PM2'
ssh -o BatchMode=yes root@64.226.123.91 bash -se <<'REMOTE'
set -Eeuo pipefail
cd /var/www/api_sequelize
export NVM_DIR="$HOME/.nvm"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then . "$NVM_DIR/nvm.sh"; fi
command -v pm2 >/dev/null || { echo 'ERROR: pm2 no disponible' >&2; exit 1; }
pm2 restart api_sequelize
sleep 3
pm2 describe api_sequelize | grep -q 'online' || { echo 'ERROR: PM2 no está online' >&2; exit 1; }
REMOTE

info '5. Comprobar endpoints'
sleep 5
health="$(curl -sS -L --max-time 15 -o /dev/null -w '%{http_code}' https://api.lujandev.com/health)"
[[ "$health" == '200' ]] || fail "/health devuelve HTTP $health"
printf '%b/health: HTTP 200%b\n' "$GREEN" "$NC"
for path in dashboard.html metrics/latest.json; do
  status="$(curl -sS -L --max-time 15 -o /dev/null -w '%{http_code}' "https://api.lujandev.com/$path" || true)"
  if [[ "$status" == '200' ]]; then
    printf '%b/%s: HTTP 200%b\n' "$GREEN" "$path" "$NC"
  else
    printf '%bAVISO: /%s devuelve HTTP %s%b\n' "$YELLOW" "$path" "${status:-sin respuesta}" "$NC"
  fi
done
printf '\n%bDespliegue API completado. Commit: %s%b\n' "$GREEN" "$local_sha" "$NC"
