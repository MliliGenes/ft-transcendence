#!/bin/sh
set -eu

cert=/etc/nginx/certs/localhost.crt
key=/etc/nginx/certs/localhost.key

# Local development certificate, retained across container recreations.
if [ ! -s "$cert" ] && [ ! -s "$key" ]; then
    mkdir -p /etc/nginx/certs
    umask 077
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
        -keyout "$key" -out "$cert" \
        -subj '/CN=localhost' \
        -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
fi

nginx -t
exec "$@"
