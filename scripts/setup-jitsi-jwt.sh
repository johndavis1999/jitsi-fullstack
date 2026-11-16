#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
compose_env="$project_root/.env"
backend_env="$project_root/backend/.env"

if [ ! -f "$compose_env" ]; then
    printf '%s\n' 'No existe .env en la raiz. Copia env.example a .env primero.' >&2
    exit 1
fi

if [ ! -f "$backend_env" ]; then
    cp "$project_root/backend/.env.example" "$backend_env"
fi

app_id=$(awk -F= '/^JWT_APP_ID=/ { print substr($0, index($0, "=") + 1); found=1 } END { if (!found) print "encuentro-local" }' "$compose_env")
secret=$(awk -F= '/^JWT_APP_SECRET=/ { print substr($0, index($0, "=") + 1); found=1 } END { if (!found) exit 1 }' "$compose_env" 2>/dev/null || true)
if [ -z "$secret" ]; then
    secret=$(openssl rand -hex 32)
fi

set_env_value() {
    file=$1
    key=$2
    value=$3
    tmp_file=$(mktemp)
    awk -v key="$key" -v value="$value" '
        BEGIN { written=0 }
        index($0, key "=") == 1 { if (!written++) print key "=" value; next }
        { print }
        END {
            if (!written) print key "=" value
        }
    ' "$file" > "$tmp_file"
    chmod 600 "$tmp_file"
    mv "$tmp_file" "$file"
}

set_env_value "$compose_env" JWT_APP_ID "$app_id"
set_env_value "$compose_env" JWT_APP_SECRET "$secret"
set_env_value "$compose_env" ENABLE_AUTH 1
set_env_value "$compose_env" ENABLE_GUESTS 1
set_env_value "$compose_env" AUTH_TYPE jwt
set_env_value "$compose_env" JICOFO_ENABLE_AUTH 0
set_env_value "$compose_env" JWT_AUTH_TYPE token
set_env_value "$compose_env" JWT_ALLOW_EMPTY 1
set_env_value "$compose_env" ENABLE_LOBBY 1
set_env_value "$compose_env" WAIT_FOR_HOST_DISABLE_AUTO_OWNERS 1
set_env_value "$compose_env" XMPP_MODULES persistent_lobby
set_env_value "$compose_env" XMPP_MUC_MODULES required_lobby,token_affiliation
set_env_value "$compose_env" XMPP_MUC_CONFIGURATION 'token_verification_require_token_for_moderation = true'

set_env_value "$backend_env" JWT_APP_ID "$app_id"
set_env_value "$backend_env" JWT_APP_SECRET "$secret"
set_env_value "$backend_env" JWT_XMPP_DOMAIN meet.jitsi

printf 'JWT configurado con app id "%s" en .env y backend/.env.\n' "$app_id"
printf '%s\n' 'Se activa JWT para hosts, invitados sin token en espera y moderación solo por token. El secreto no se muestra.'
printf '%s\n' 'Reinicia Jitsi cuando no haya reuniones activas.'
