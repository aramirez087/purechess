---
session: 3
title: "Engine client: eval/PV, hint, ELO target, blunder, think-time, abort, warm-up"
depends_on: [1]
touches:
  - apps/web/src/lib/engine/stockfish-client.ts
  - apps/web/test/engine/**
parallel_safe: true
produces:
  - apps/web/src/lib/engine/stockfish-client.ts
  - apps/web/test/engine/stockfish-client.test.ts
model: "opus"
---

# Session 03: Engine client capabilities

Paste this into a new Claude Code session:

```md
Continue from Session 01 artifacts. Read docs/roadmap/vs-computer-foundations/session-01-handoff.md
for EngineEval / EngineAnalysisOptions before coding.

Mission: Extend the client-side Stockfish wrapper so it exposes evaluation, principal variations,
hints, adjustable strength, adjustable think-time, cancellation, and a warm-up signal — while
keeping the existing getBestMove behavior working.

Repository anchors:
- apps/web/src/lib/engine/stockfish-client.ts (single shared Worker; getBestMove listens only for
  "bestmove"; UCI_SKILL 8 buckets; movetime hardcoded 1000; 10s timeout silently rejects)
- packages/shared/src/dto/engine-analysis.dto.ts (EngineEval, EngineAnalysisOptions)

Tasks:
1. Parse `info` lines (depth, score cp/mate, multipv, pv) into EngineEval objects; expose an
   `analyze(fen, options)` that resolves the final EngineEval and supports MultiPV (top 1-3).
2. Add `getHint(fen, level)` returning the best move for the side to move (UCI), reusing analyze.
3. Strength: support both Skill Level (existing buckets) and ELO-target mode via UCI options
   `UCI_LimitStrength=true` + `UCI_Elo=<n>` when EngineAnalysisOptions.eloTarget is set.
4. Style/blunder knob: when blunderCp is set, optionally pick a near-best PV move within ±blunderCp
   of the top eval (use MultiPV) so lower levels feel human. Deterministic given deterministicSeed.
5. Make think-time configurable (movetimeMs option; keep default 1000); add an AbortController-style
   `cancel` so an in-flight `go` can be stopped (send `stop`, resolve/reject cleanly).
6. Warm-up: export `warmUp()` / a ready promise and surface uci handshake state; replace the silent
   10s timeout rejection with a typed, catchable EngineTimeoutError.
7. Add Vitest unit tests under apps/web/test/engine/ that mock the Worker postMessage/onmessage and
   assert info-line parsing, hint output, ELO option emission, cancellation, and timeout error type.

Deliverables:
- Rewritten apps/web/src/lib/engine/stockfish-client.ts (backward-compatible getBestMove).
- apps/web/test/engine/stockfish-client.test.ts.
- docs/roadmap/vs-computer-foundations/session-03-handoff.md documenting the public API surface.

Quality gates (run, must pass):
- pnpm --filter @purechess/shared build
- cd apps/web && pnpm typecheck && pnpm lint && pnpm exec vitest run test/

Exit criteria: analyze/getHint/cancel/warmUp exported and typed against shared; tests pass with a
mocked Worker; getBestMove still returns a UCI move for existing callers.
```
