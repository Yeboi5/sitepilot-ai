#!/usr/bin/env bash
# Applies the Supabase migrations and seed to a throwaway plain PostgreSQL
# database (with a minimal Supabase shim) and checks integrity rules and RLS.
#   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."
ADMIN_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
DB="dealpilot_test_$$"
psql "$ADMIN_URL" -qc "create database $DB" >/dev/null
trap 'psql "$ADMIN_URL" -qc "drop database if exists $DB" >/dev/null' EXIT
URL="${ADMIN_URL%/*}/$DB"
run() { psql "$URL" -v ON_ERROR_STOP=1 -q "$@"; }

run -f supabase/tests/supabase-shim.sql >/dev/null
for f in supabase/migrations/*.sql; do run -f "$f" >/dev/null; done
run -f supabase/seed.sql >/dev/null
# pipefail propagates a psql failure through sed.
run -t -f supabase/tests/checks.sql 2>&1 | sed -n 's/.*NOTICE:  /  /p; s/.*ERROR:  /  FAILED: /p'
echo "Database checks passed"
