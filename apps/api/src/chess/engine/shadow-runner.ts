import type { EngineAdapter, LegalMove } from './adapter';

export interface GameTrace {
  name: string;
  startFen: string;
  ucis: string[];
  terminalPly?: number;
  expectedResult?: { result: string; reason: string };
}

export interface DivergenceDetail {
  traceName: string;
  ply: number;
  method: 'validateMove' | 'legalMoves' | 'detectResult' | 'applyMoves';
  fen: string;
  uci?: string;
  tsResult: unknown;
  nativeResult: unknown;
}

export interface ShadowSummary {
  tracesRun: number;
  divergences: number;
  divergenceDetails: DivergenceDetail[];
}

function sortMoves(moves: LegalMove[]): LegalMove[] {
  return [...moves].sort((a, b) => a.uci.localeCompare(b.uci));
}

function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function settled<T>(p: Promise<T>): Promise<{ ok: true; val: T } | { ok: false; err: string }> {
  try {
    return { ok: true, val: await p };
  } catch (e) {
    return { ok: false, err: String(e) };
  }
}

export async function runShadowSuite(
  traces: GameTrace[],
  ts: EngineAdapter,
  native: EngineAdapter,
): Promise<ShadowSummary> {
  const details: DivergenceDetail[] = [];

  for (const trace of traces) {
    const { name: traceName, startFen, ucis } = trace;

    for (let ply = 0; ply < ucis.length; ply++) {
      const currentUcis = ucis.slice(0, ply);
      const nextUci = ucis[ply]!;

      // Derive current FEN by applying moves so far (via TS adapter — it's the reference)
      let fen = startFen;
      if (currentUcis.length > 0) {
        const state = await ts.applyMoves(startFen, currentUcis);
        fen = state.fen;
      }

      // 1. validateMove comparison
      {
        const [tsR, nativeR] = await Promise.all([
          settled(ts.validateMove(fen, nextUci)),
          settled(native.validateMove(fen, nextUci)),
        ]);
        if (!equal(tsR, nativeR)) {
          details.push({
            traceName,
            ply,
            method: 'validateMove',
            fen,
            uci: nextUci,
            tsResult: tsR,
            nativeResult: nativeR,
          });
        }
      }

      // 2. legalMoves comparison (sorted)
      {
        const [tsR, nativeR] = await Promise.all([
          settled(ts.legalMoves(fen)),
          settled(native.legalMoves(fen)),
        ]);
        const tsNorm = tsR.ok ? { ok: true as const, val: sortMoves(tsR.val) } : tsR;
        const nativeNorm = nativeR.ok ? { ok: true as const, val: sortMoves(nativeR.val) } : nativeR;
        if (!equal(tsNorm, nativeNorm)) {
          details.push({
            traceName,
            ply,
            method: 'legalMoves',
            fen,
            tsResult: tsNorm,
            nativeResult: nativeNorm,
          });
        }
      }

      // 3. detectResult comparison
      {
        const [tsR, nativeR] = await Promise.all([
          settled(ts.detectResult(fen)),
          settled(native.detectResult(fen)),
        ]);
        if (!equal(tsR, nativeR)) {
          details.push({
            traceName,
            ply,
            method: 'detectResult',
            fen,
            tsResult: tsR,
            nativeResult: nativeR,
          });
        }
      }

      // 4. applyMoves comparison (moves up to and including this ply)
      {
        const applyUcis = ucis.slice(0, ply + 1);
        const [tsR, nativeR] = await Promise.all([
          settled(ts.applyMoves(startFen, applyUcis)),
          settled(native.applyMoves(startFen, applyUcis)),
        ]);
        if (!equal(tsR, nativeR)) {
          details.push({
            traceName,
            ply,
            method: 'applyMoves',
            fen,
            tsResult: tsR,
            nativeResult: nativeR,
          });
        }
      }
    }
  }

  return {
    tracesRun: traces.length,
    divergences: details.length,
    divergenceDetails: details,
  };
}
