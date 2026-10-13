#!/bin/bash
# HTTPS gateway smoke for the auth-game integration (Task 7).
# Static config assertions + live gateway assertions over https://localhost.
# Fails until Compose + gateway + nginx + env land; passes after.
set -u

BASE="${SMOKE_BASE:-https://localhost}"
CONF="infra/nginx/nginx.conf"
COMPOSE="docker-compose.yml"
GATEWAY_DOCKERFILE="infra/gateway/Dockerfile"
ENV_EXAMPLE=".env.example"
INIT_DB="infra/postgres/init-db.sh"

fail=0
pass=0
ok() { pass=$((pass + 1)); echo "ok: $1"; }
bad() { fail=$((fail + 1)); echo "FAIL: $1"; }

# ---------- static config ----------

[ -f "$GATEWAY_DOCKERFILE" ] || bad "missing $GATEWAY_DOCKERFILE"
if [ -f "$GATEWAY_DOCKERFILE" ]; then
  grep -q "node:22" "$GATEWAY_DOCKERFILE" || bad "gateway Dockerfile lacks Node 22 Arena stage"
  grep -q "node:24" "$GATEWAY_DOCKERFILE" || bad "gateway Dockerfile lacks Node 24 auth stage"
  grep -q "/usr/share/nginx/html/play/" "$GATEWAY_DOCKERFILE" || bad "gateway Dockerfile lacks Arena /play/ output"
  grep -q "/usr/share/nginx/html/" "$GATEWAY_DOCKERFILE" || bad "gateway Dockerfile lacks auth / output"
  [ "$(grep -c "node:22\|node:24" "$GATEWAY_DOCKERFILE")" -ge 2 ] && ok "gateway Dockerfile multi-stage" || true
fi

grep -q "user-db" "$COMPOSE" || bad "compose lacks user-db"
grep -q "user-service" "$COMPOSE" || bad "compose lacks user-service"
grep -q "userpgdata" "$COMPOSE" || bad "compose lacks userpgdata volume"
grep -q "pgdata" "$COMPOSE" || bad "compose lacks pgdata volume"
grep -q "infra/gateway/Dockerfile" "$COMPOSE" || bad "compose lacks gateway static build"
if grep -vE '^\s*#' "$COMPOSE" | grep -q "compose\.yaml"; then bad "compose must not import Saad root compose.yaml"; else ok "compose standalone (no Saad compose.yaml import)"; fi

[ -f "$CONF" ] || bad "missing $CONF"
if [ -f "$CONF" ]; then
  grep -q "proxy_cookie_path /auth/ /api/auth/" "$CONF" || bad "nginx lacks proxy_cookie_path /auth/ /api/auth/"
  grep -q "location /api/" "$CONF" || bad "nginx lacks /api/ user-service route"
  grep -q "user-service:3000" "$CONF" || bad "nginx /api/ does not target user-service:3000"
  grep -q "location /api/game/" "$CONF" || bad "nginx lacks /api/game/ route"
  grep -q "location /socket.io/" "$CONF" || bad "nginx lacks /socket.io/ route"
  grep -q "matches|lobby" "$CONF" || bad "nginx lacks matches|lobby route"
  grep -q "location = /play" "$CONF" || bad "nginx lacks /play redirect"
  grep -q "try_files" "$CONF" || bad "nginx lacks SPA fallbacks"
  grep -q "X-Requested-With" "$CONF" || bad "nginx lacks custom-header CSRF check"
  grep -q "location = /health" "$CONF" || bad "nginx lacks exempt /health"
  grep -q "location = /ready" "$CONF" || bad "nginx lacks exempt /ready"
  if grep -q "api_all" "$CONF"; then bad "nginx must not reference blanket api_all limits"; else ok "no blanket api_all limit"; fi
  if grep -q '\$request[ ;"]' "$CONF"; then bad "gateway log must omit \$request (query leaks)"; else ok "access log omits \$request"; fi
  if grep -q '\$args\|\$query_string' "$CONF"; then bad "gateway log must omit query args"; else ok "access log omits query args"; fi
  # Credential limits exist on exact public paths ...
  if [ "$(grep -c "limit_req zone=" "$CONF")" -lt 3 ]; then
    bad "nginx lacks exact-path credential limits (login/register/reset/refresh)"
  else
    ok "exact-path credential limits present"
  fi
  # ... but NOT on game/socket locations.
  block_has_limit() {
    awk -v start="$1" '
      index($0, start) {inside=1; next}
      inside && /^    \}/ {inside=0}
      inside && /limit_req zone=/ {found=1}
      END {exit found ? 0 : 1}' "$CONF"
  }
  if block_has_limit "location /api/game/"; then bad "game route must not be rate-limited"; else ok "game route unlimited"; fi
  if block_has_limit "location /socket.io/"; then bad "socket route must not be rate-limited"; else ok "socket route unlimited"; fi
  if block_has_limit "matches|lobby"; then bad "matches|lobby route must not be rate-limited"; else ok "matches|lobby unlimited"; fi
fi

for key in GAME_DB_NAME GAME_DB_USER GAME_DB_PASSWORD USER_DB_NAME USER_DB_USER USER_DB_PASSWORD \
    JWT_PRIVATE_KEY JWT_PUBLIC_KEY SUPERADMIN_USERNAME SUPERADMIN_EMAIL SUPERADMIN_PASSWORD \
    AUTH_FRONTEND_URL SMTP_HOST SMTP_PORT SMTP_USERNAME SMTP_PASSWORD; do
  grep -q "^$key=" "$ENV_EXAMPLE" || bad ".env.example lacks $key"
done
grep -q "^DEV_PRINCIPAL=false" "$ENV_EXAMPLE" || bad ".env.example lacks DEV_PRINCIPAL=false"
ok ".env.example keys checked"

grep -q "GAME_DB_USER" "$INIT_DB" || bad "init-db.sh lacks game role"
grep -q "USER_DB_USER" "$INIT_DB" || bad "init-db.sh lacks user role"
ok "init-db.sh roles checked"

# ---------- live gateway ----------

probe() { curl -ks -o /dev/null -w "%{http_code}" -m 10 "$@"; }

if [ "$(probe "$BASE/health")" != "200" ]; then
  bad "gateway not reachable at $BASE (run: npm run certs; cp .env.example .env; npm run up)"
  echo "---"
  echo "smoke: $pass passed, $fail failed"
  exit 1
fi
ok "gateway reachable"

[ "$(probe "$BASE/health")" = "200" ] && ok "/health exempt" || bad "/health must be 200 without credentials"
[ "$(probe "$BASE/ready")" = "200" ] && ok "/ready exempt" || bad "/ready must be 200 without credentials"

body=$(curl -ks -m 10 "$BASE/")
echo "$body" | grep -q "Fieldnote" && ok "/ serves auth SPA" || bad "/ must serve auth SPA (login)"
body=$(curl -ks -m 10 "$BASE/play/")
echo "$body" | grep -q "Code Arena" && ok "/play/ serves game SPA" || bad "/play/ must serve game SPA"
echo "$body" | grep -q "/play/assets/" && ok "/play/ assets under /play/" || bad "/play/ assets must use /play/ base"
arena_js=$(echo "$body" | grep -o "/play/assets/[^\"']*\.js" | head -1)
[ -n "$arena_js" ] && [ "$(curl -ks -o /dev/null -w "%{content_type}" -m 10 "$BASE$arena_js")" = "application/javascript" ] \
  && ok "/play/ scripts serve application/javascript" || bad "/play/ module scripts must be application/javascript (mime.types)"
auth_js=$(curl -ks -m 10 "$BASE/" | grep -o "/assets/[^\"']*\.js" | head -1)
[ -n "$auth_js" ] && [ "$(curl -ks -o /dev/null -w "%{content_type}" -m 10 "$BASE$auth_js")" = "application/javascript" ] \
  && ok "/ scripts serve application/javascript" || bad "/ module scripts must be application/javascript (mime.types)"

redir=$(curl -ks -o /dev/null -w "%{http_code} %{redirect_url}" -m 10 "$BASE/play")
echo "$redir" | grep -q "^301 " || bad "/play must 301"
echo "$redir" | grep -q "/play/$" && ok "/play redirects to /play/" || bad "/play must redirect to /play/"

[ "$(probe "$BASE/api/game/matches/smoke-probe/snapshot")" = "401" ] \
  && ok "/api/game/ 401 without token" || bad "/api/game/ must 401 without token"

sock=$(curl -ks -m 10 "$BASE/socket.io/?EIO=4&transport=polling")
echo "$sock" | grep -q "sid" && ok "/socket.io/ reachable" || bad "/socket.io/ must answer engine.io handshake"

# Refresh with browser headers, no cookie: 401 + rotated cookie attrs, no legacy root cookie.
hdrs=$(curl -ks -m 10 -D - -o /dev/null -X POST "$BASE/api/auth/refresh" \
  -H "Origin: https://localhost" -H "X-Requested-With: XMLHttpRequest")
echo "$hdrs" | head -1 | grep -q "401" && ok "refresh 401 without cookie" || bad "refresh without cookie must 401"
echo "$hdrs" | grep -i "^set-cookie:" | grep -q "Path=/api/auth/" \
  && ok "refresh cookie Path=/api/auth/" || bad "refresh must set Path=/api/auth/"
echo "$hdrs" | grep -i "^set-cookie:" | grep -qi "httponly" \
  && ok "refresh cookie HttpOnly" || bad "refresh must set HttpOnly"
echo "$hdrs" | grep -i "^set-cookie:" | grep -qi "secure" \
  && ok "refresh cookie Secure" || bad "refresh must set Secure"
echo "$hdrs" | grep -i "^set-cookie:" | grep -qi "samesite=lax" \
  && ok "refresh cookie SameSite=Lax" || bad "refresh must set SameSite=Lax"
if echo "$hdrs" | grep -i "^set-cookie:.*auth-refresh" | grep -qi "Path=/;"; then
  bad "legacy root-path auth-refresh cookie must never be set"
else
  ok "no legacy root-path auth-refresh cookie"
fi

# CSRF: cookie endpoint without custom header and/or Origin+Referer must 403.
login_body='{"email":"smoke-no-such-user@example.com","password":"Smoke12345!"}'
[ "$(probe -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d "$login_body")" = "403" ] \
  && ok "login 403 without CSRF headers" || bad "login without X-Requested-With/Origin must 403"
[ "$(probe -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" -d "$login_body")" = "403" ] \
  && ok "login 403 without Origin/Referer" || bad "login without Origin and Referer must 403"
passthrough=$(probe -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" -H "Origin: https://localhost" -d "$login_body")
[ "$passthrough" = "401" ] \
  && ok "login with CSRF headers passes through (401 bad creds)" || bad "login with CSRF headers must reach user-service (got $passthrough)"

# Query-free access log: OAuth-style secret must not appear in gateway logs.
# (The secret travels in the query only; the path token is a fixed probe.)
secret="code-SECRET-$(date +%s)"
curl -ks -m 10 -o /dev/null "$BASE/api/auth/verify-email/probe-token?code=${secret}&state=${secret}" || true
if docker compose ps nginx 2>/dev/null | grep -q "Up\|running"; then
  if docker compose logs --no-log-prefix --since 5m nginx 2>/dev/null | grep -q "$secret"; then
    bad "gateway access log leaked query secret"
  else
    ok "gateway access log omits query"
  fi
else
  bad "nginx container not running; cannot verify query-free log"
fi

echo "---"
echo "smoke: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
