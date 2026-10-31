#!/bin/bash
# One-command fresh host setup for Code Arena & Fieldnote Accounts.
# Generates dev TLS certs, configures .env with RSA keypair, starts Docker,
# waits for healthchecks, and seeds Alice & Bob test accounts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1. Generating Dev TLS Certificates ==="
bash scripts/gen-dev-certs.sh

echo "=== 2. Configuring .env with RSA Keypair ==="
node scripts/setup-env.mjs

echo "=== 3. Starting Docker Compose Stack ==="
docker compose up --build -d

echo "=== 4. Waiting for Services to be Healthy ==="
for i in {1..30}; do
  if docker compose ps user-service 2>/dev/null | grep -q "healthy" && docker compose ps game 2>/dev/null | grep -q "healthy"; then
    echo "All core services are healthy!"
    break
  fi
  echo "Waiting for services to become healthy... ($i/30)"
  sleep 2
done

echo "=== 5. Seeding Test Accounts (Alice, Bob, Carol, Dave) ==="
docker compose exec -T user-db psql -U arena_admin -d user_db -c "
INSERT INTO \"User\" (\"id\", \"username\", \"email\", \"passwordHash\", \"role\", \"updatedAt\")
VALUES
  (gen_random_uuid(), 'alice', 'alice@example.com', '\$2b\$12\$1e9zk19QlgNqrq0Vwx0etene8FnC0LUl8CFxw4igO/cIo83yoHKsq', 'USER', NOW()),
  (gen_random_uuid(), 'bob', 'bob@example.com', '\$2b\$12\$1e9zk19QlgNqrq0Vwx0etene8FnC0LUl8CFxw4igO/cIo83yoHKsq', 'USER', NOW()),
  (gen_random_uuid(), 'carol', 'carol@example.com', '\$2b\$12\$1e9zk19QlgNqrq0Vwx0etene8FnC0LUl8CFxw4igO/cIo83yoHKsq', 'USER', NOW()),
  (gen_random_uuid(), 'dave', 'dave@example.com', '\$2b\$12\$1e9zk19QlgNqrq0Vwx0etene8FnC0LUl8CFxw4igO/cIo83yoHKsq', 'USER', NOW())
ON CONFLICT (\"username\") DO NOTHING;
"

echo ""
echo "==========================================================="
echo "   Code Arena & Fieldnote Account Setup 100% Complete!     "
echo "==========================================================="
echo " - Accounts & Ingress:  https://localhost/"
echo " - Code Arena Lobby:    https://localhost/play/"
echo " - Superadmin:          superadmin@example.com / change-me-8-chars-min"
echo " - Alice (Host):        alice@example.com      / Password123!"
echo " - Bob (Challenger):    bob@example.com        / Password123!"
echo "==========================================================="
