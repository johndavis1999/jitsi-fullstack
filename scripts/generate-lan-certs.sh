#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_root"
umask 077

cert_dir=.local-certs
key_dir=.jitsi-meet-cfg/web/keys
mkdir -p "$cert_dir" "$key_dir"

if [ -s "$cert_dir/lan-ca.key" ] && [ -s "$cert_dir/lan-ca.crt" ]; then
    :
elif [ ! -e "$cert_dir/lan-ca.key" ] && [ ! -e "$cert_dir/lan-ca.crt" ]; then
    openssl req -x509 -newkey rsa:4096 -nodes -sha256 -days 3650 \
        -config certs/lan-ca.cnf \
        -keyout "$cert_dir/lan-ca.key" \
        -out "$cert_dir/lan-ca.crt"
else
    printf '%s\n' 'Incomplete LAN CA files in .local-certs; inspect them before continuing.' >&2
    exit 1
fi

openssl req -new -newkey rsa:2048 -nodes -sha256 \
    -config certs/lan-server.cnf \
    -keyout "$cert_dir/lan-server.key" \
    -out "$cert_dir/lan-server.csr"
openssl x509 -req -sha256 -days 825 \
    -in "$cert_dir/lan-server.csr" \
    -CA "$cert_dir/lan-ca.crt" \
    -CAkey "$cert_dir/lan-ca.key" \
    -CAcreateserial \
    -extfile certs/lan-server.cnf \
    -extensions server_cert \
    -out "$cert_dir/lan-server.crt"

cp "$cert_dir/lan-server.key" "$key_dir/cert.key"
cp "$cert_dir/lan-server.crt" "$key_dir/cert.crt"
chmod 600 "$cert_dir/lan-ca.key" "$cert_dir/lan-server.key" "$key_dir/cert.key"
chmod 644 "$cert_dir/lan-ca.crt" "$cert_dir/lan-server.crt" "$key_dir/cert.crt"

printf 'Trust this root certificate on client devices: %s/%s/lan-ca.crt\n' "$project_root" "$cert_dir"
printf '%s\n' 'Server URL: https://192.168.31.244:8443'