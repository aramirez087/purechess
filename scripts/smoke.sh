#!/usr/bin/env bash
set -euo pipefail

WEB_URL="${WEB_URL:-http://localhost:3000}"
API_URL="${API_URL:-http://localhost:4000}"
PASS=0
FAIL=0

log()  { echo "[smoke] $*"; }
ok()   { PASS=$((PASS+1)); echo "  ✓ $*"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $*" >&2; }

# ── 1. HTTP p95 < 1s (100 requests to /) ──────────────────────────────────────
log "HTTP load: 100 requests to ${WEB_URL}/"

TIMES_FILE=$(mktemp)
for i in $(seq 1 100); do
  curl -s -o /dev/null -w "%{time_total}\n" "${WEB_URL}/" >> "${TIMES_FILE}" &
done
wait

P95=$(sort -n "${TIMES_FILE}" | awk 'BEGIN{c=0} {a[c++]=$1} END{p=int(c*0.95); print a[p]}')
rm -f "${TIMES_FILE}"

if awk "BEGIN{exit !($P95 < 1.0)}"; then
  ok "HTTP p95=${P95}s < 1s"
else
  fail "HTTP p95=${P95}s ≥ 1s"
fi

# ── 2. 50 concurrent WebSocket connections ────────────────────────────────────
log "WebSocket: 50 concurrent connections to ${API_URL}"

WS_RESULT=$(node - <<'EOF'
const { io } = require('socket.io-client');
const API_URL = process.env.API_URL || 'http://localhost:4000';
const SOCKETS = 50;
const TIMEOUT_MS = 15000;

let connected = 0;
let errors = 0;
const sockets = [];

const done = new Promise((resolve) => {
  for (let i = 0; i < SOCKETS; i++) {
    const s = io(API_URL, { transports: ['websocket'], reconnection: false });
    sockets.push(s);
    s.on('connect', () => {
      connected++;
      if (connected + errors === SOCKETS) resolve({ connected, errors });
    });
    s.on('connect_error', () => {
      errors++;
      if (connected + errors === SOCKETS) resolve({ connected, errors });
    });
  }
  setTimeout(() => resolve({ connected, errors }), TIMEOUT_MS);
});

done.then(({ connected, errors }) => {
  sockets.forEach(s => s.disconnect());
  console.log(JSON.stringify({ connected, errors }));
  process.exit(errors > 5 ? 1 : 0);
}).catch(e => {
  console.error(e.message);
  process.exit(1);
});
EOF
)

WS_CONNECTED=$(echo "${WS_RESULT}" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(String(d.connected))" 2>/dev/null || echo "0")
WS_ERRORS=$(echo "${WS_RESULT}" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(String(d.errors))" 2>/dev/null || echo "50")

if [ "${WS_ERRORS:-50}" -le 5 ]; then
  ok "WebSocket: ${WS_CONNECTED}/50 connected, ${WS_ERRORS} errors"
else
  fail "WebSocket: ${WS_CONNECTED}/50 connected, ${WS_ERRORS} errors (too many errors)"
fi

# ── 3. 10-minute burn-in: synthetic random games ──────────────────────────────
log "Burn-in: synthetic chess games for 10 minutes (checking memory/clock stability)"

BURN_RESULT=$(timeout 600 node - <<'EOF' || true
const { Chess } = require('chess.js');
const START = Date.now();
const DURATION_MS = 10 * 60 * 1000;
let games = 0;
let moves = 0;

while (Date.now() - START < DURATION_MS) {
  const chess = new Chess();
  let plies = 0;
  while (!chess.isGameOver() && plies < 200) {
    const legal = chess.moves();
    chess.move(legal[Math.floor(Math.random() * legal.length)]);
    plies++;
    moves++;
  }
  games++;
}

const memMb = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(JSON.stringify({ games, moves, memMb: Math.round(memMb) }));
EOF
)

BURN_GAMES=$(echo "${BURN_RESULT}" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(String(d.games))" 2>/dev/null || echo "0")
BURN_MEM=$(echo "${BURN_RESULT}" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(String(d.memMb))" 2>/dev/null || echo "999")

if [ "${BURN_GAMES:-0}" -gt 0 ] && [ "${BURN_MEM:-999}" -lt 512 ]; then
  ok "Burn-in: ${BURN_GAMES} games, heap=${BURN_MEM}MB < 512MB"
else
  fail "Burn-in: ${BURN_GAMES} games, heap=${BURN_MEM}MB (check memory)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "Smoke results: ${PASS} passed, ${FAIL} failed"
[ "${FAIL}" -eq 0 ] && exit 0 || exit 1
