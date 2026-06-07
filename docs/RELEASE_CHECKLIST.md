# Purechess MVP Release Checklist

Complete this checklist from a clean checkout before any production release.
Target: all items checked in under 30 minutes.

---

## 1. Users can register and log in

- [ ] **E2E**: `pnpm --filter @purechess/web e2e -- --grep "register|login"` passes
- [ ] **Manual**: Open app → Register with email → Confirm session cookie set → Log out → Log in again
- **Owner**: backend / auth

---

## 2. Anonymous users can play casual games

- [ ] **E2E**: `pnpm --filter @purechess/web e2e -- --grep "anon-casual"` passes
- [ ] **Manual**: Open two incognito tabs → both join Quick Match → game starts → play 3 moves each
- **Owner**: matchmaking / frontend

---

## 3. Registered users can play rated games

- [ ] **E2E**: `pnpm --filter @purechess/web e2e -- --grep "rated-game"` passes
- [ ] **Manual**: Sign in as two users → join rated blitz queue → game starts → rating shown post-game
- **Owner**: matchmaking / ratings

---

## 4. Matchmaking works for all supported time controls

- [ ] **E2E**: Run parameterized suite across all 6 time controls:

```bash
for TC in "bullet:60:0" "bullet:120:1" "blitz:180:0" "blitz:300:3" "rapid:600:0" "rapid:900:10"; do
  IFS=: read CAT SECS INC <<< "$TC"
  echo "Testing $CAT ${SECS}+${INC}"
done
```

- [ ] **Manual**: Verify each time control label appears correctly on the UI
- **Owner**: matchmaking

---

## 5. Game state is reliable

- [ ] **Smoke**: `bash scripts/smoke.sh` burn-in completes 10 minutes, heap < 512MB
- [ ] **Manual**: Play a full game to checkmate, verify final FEN is correct
- **Owner**: chess engine / game service

---

## 6. Clocks are accurate

- [ ] **Unit**: `pnpm --filter @purechess/api test -- --testPathPattern="chess/engine"` passes (clock tests ≥ 90% coverage)
- [ ] **Smoke**: `bash scripts/smoke.sh` WebSocket 60s tick shows no errors
- [ ] **Manual**: Start a 1+0 bullet game, observe clocks count down correctly
- **Owner**: clock / game service

---

## 7. Reconnection works

- [ ] **E2E**: `pnpm --filter @purechess/web e2e -- --grep "reconnect"` passes
- [ ] **Manual**: Mid-game, disable Wi-Fi for 5s, re-enable — board syncs within 10s
- **Owner**: realtime / WebSocket

---

## 8. Ratings update correctly

- [ ] **Unit**: `pnpm --filter @purechess/api test -- --testPathPattern="ratings"` passes (Glicko-2 delta assertions)
- [ ] **E2E**: `pnpm --filter @purechess/web e2e -- --grep "rated-game"` shows rating delta overlay
- [ ] **Manual**: Play a rated game, note ratings before and after, verify delta matches expected Glicko-2 output
- **Owner**: ratings service

---

## 9. Completed games can be reviewed

- [ ] **E2E**: `pnpm --filter @purechess/web e2e -- --grep "game-review"` passes
- [ ] **Manual**: Open a completed game → step through moves with arrow keys → all positions render correctly
- **Owner**: game review / frontend

---

## 10. PGN can be copied/exported

- [ ] **E2E**: `pnpm --filter @purechess/web e2e -- --grep "game-review"` clipboard check passes
- [ ] **Manual**: On a completed game → click "Copy PGN" → paste into a PGN viewer and verify it parses
- **Owner**: frontend / game review

---

## 11. Admin can review reports

- [ ] **E2E**: `pnpm --filter @purechess/web e2e -- --grep "admin-disable"` passes
- [ ] **API Integration**: `pnpm --filter @purechess/api test:e2e -- --testPathPattern="admin"` passes
- [ ] **Manual**: Submit a report in-game → log in as admin → review report → take action → audit log updated
- **Owner**: admin / moderation

---

## 12. Board feels fast, clean, and stable on desktop and mobile

- [ ] **Lighthouse** (homepage): Performance ≥ 95, Accessibility ≥ 95

```bash
npx lighthouse http://localhost:3000 --only-categories=performance,accessibility --output=json | jq '.categories | {perf: .performance.score, a11y: .accessibility.score}'
```

- [ ] **Manual — iPhone (Safari)**: Board renders, pieces draggable / tap-to-move works, clocks visible
- [ ] **Manual — Android Chrome**: Same as above
- [ ] **Manual — Desktop Safari**: No visual regressions
- **Owner**: frontend

---

## Full suite command

```bash
# API unit + integration
pnpm --filter @purechess/api test
pnpm --filter @purechess/api test:e2e

# Web unit
pnpm --filter @purechess/web test

# Playwright E2E (requires running stack)
pnpm --filter @purechess/web e2e

# Smoke (requires running stack)
bash scripts/smoke.sh
```

---

*This checklist doubles as the launch readiness review. Update it as the system grows.*
