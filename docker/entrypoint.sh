#!/bin/sh
# Entrada da imagem: cria/atualiza o super administrador (se as variáveis estiverem definidas;
# aplica as migrations antes) e sobe o PocketBase com a API e o web.
set -e

ARGS="--dir=/pb_data --hooksDir=/app/pb_hooks --migrationsDir=/app/pb_migrations --publicDir=/app/pb_public"

if [ -n "$KAMBAN_ADMIN_EMAIL" ] && [ -n "$KAMBAN_ADMIN_PASSWORD" ]; then
  # shellcheck disable=SC2086
  /app/pocketbase kamban-admin $ARGS
fi

# shellcheck disable=SC2086
# pool de VMs do JS (padrão do PocketBase: 15) — ver docs/deployment.md
exec /app/pocketbase serve --http="${KAMBAN_HTTP:-0.0.0.0:8090}" --hooksPool="${KAMBAN_HOOKS_POOL:-60}" $ARGS
