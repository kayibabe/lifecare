#!/bin/sh
# Railway assigns the listen port at runtime via $PORT — substitute it into
# the nginx template before starting nginx (nginx.conf can't read env vars
# directly). Falls back to 8080 for local `docker run` without -e PORT=.
# This is a plain literal-placeholder substitution, not nginx's own
# envsubst-based /etc/nginx/templates/ mechanism (this image's default
# ENTRYPOINT, which does that, is overridden by this script).
set -e

PORT="${PORT:-8080}"

sed "s/__PORT__/$PORT/g" /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
