#!/usr/bin/env bash
# SSR regression test: builds the app and verifies that GET /tasks
# server-renders without runtime errors (no h3 500, no rrule import crash, etc.).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[ssr-test] Building (build:dev)…"
bun run build:dev >/tmp/ssr-build.log 2>&1 || {
  echo "[ssr-test] BUILD FAILED"; tail -n 40 /tmp/ssr-build.log; exit 1;
}

PORT="${SSR_TEST_PORT:-8799}"
LOG=/tmp/ssr-wrangler.log
: > "$LOG"

echo "[ssr-test] Starting wrangler dev on :$PORT…"
(cd dist/server && npx --yes wrangler@4 dev --port "$PORT" --ip 127.0.0.1 --log-level warn >"$LOG" 2>&1) &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

echo "[ssr-test] Waiting for server…"
for i in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:$PORT/" -o /dev/null; then break; fi
  sleep 0.5
done

echo "[ssr-test] GET /tasks…"
BODY=$(mktemp)
CODE=$(curl -s -o "$BODY" -w "%{http_code}" "http://127.0.0.1:$PORT/tasks" || true)

FAIL=0
if [ "$CODE" != "200" ] && [ "$CODE" != "302" ]; then
  echo "[ssr-test] FAIL: HTTP $CODE"; FAIL=1
fi
if grep -q '"unhandled":true' "$BODY"; then
  echo "[ssr-test] FAIL: h3 swallowed SSR error"; FAIL=1
fi
if grep -qiE 'does not provide an export named|Cannot read properties of undefined' "$BODY" "$LOG"; then
  echo "[ssr-test] FAIL: runtime error markers found"
  grep -iE 'does not provide an export named|Cannot read properties of undefined' "$BODY" "$LOG" | head -5
  FAIL=1
fi

if [ "$FAIL" = "1" ]; then
  echo "----- response body (head) -----"; head -c 600 "$BODY"; echo
  echo "----- wrangler log (tail) -----"; tail -n 40 "$LOG"
  exit 1
fi

echo "[ssr-test] OK: /tasks server-rendered cleanly (HTTP $CODE)"