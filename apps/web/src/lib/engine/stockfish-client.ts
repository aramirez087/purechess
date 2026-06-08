'use client';

/**
 * Client-side Stockfish wrapper.
 *
 * Vs-computer games are unrated, so the engine runs in the browser in a Web
 * Worker (assets under /public/stockfish). The server only validates and
 * records moves — it never runs an engine. This ports the UCI handshake that
 * used to live in the API's stockfish.service.ts to the browser, where
 * `postMessage` actually exists.
 *
 * The single shared worker is stateful (UCI runs one search at a time), so all
 * public calls are serialized through an internal job queue. Each job emits its
 * full `setoption` set before every `go`, so no caller can inherit stale
 * MultiPV / strength / Skill state from a prior job.
 */

import type {
  EngineAnalysisOptions,
  EngineEval,
} from '@purechess/shared';

// Difficulty level (1-8) -> UCI "Skill Level" (0-20).
const UCI_SKILL = [0, 3, 5, 8, 11, 14, 17, 20] as const;

const DEFAULT_MOVETIME_MS = 1000;
const BESTMOVE_TIMEOUT_MS = 10_000;
/** Extra slack beyond movetime before a search is considered hung. */
const TIMEOUT_BUFFER_MS = 5_000;

// UCI_Elo range accepted by the vendored Stockfish build.
const UCI_ELO_MIN = 1320;
const UCI_ELO_MAX = 3190;

/** Signed sentinel used so a mate score sorts/windows against centipawn lines. */
const MATE_CP_SENTINEL = 100_000;

/** Thrown when a search produces no `bestmove` within its timeout window. */
export class EngineTimeoutError extends Error {
  constructor(message = 'Stockfish timeout: no bestmove') {
    super(message);
    this.name = 'EngineTimeoutError';
  }
}

/** Thrown into the in-flight job when `cancel()` stops a running search. */
export class EngineCancelledError extends Error {
  constructor(message = 'Stockfish search cancelled') {
    super(message);
    this.name = 'EngineCancelledError';
  }
}

let workerPromise: Promise<Worker> | null = null;

/** Tail of the serialized job queue — every public call chains onto this. */
let currentJob: Promise<unknown> = Promise.resolve();

/** Cancel handle for the job currently holding the worker (null when idle). */
let activeJob: { cancel: (err: Error) => void } | null = null;

function wasmSupported(): boolean {
  return (
    typeof WebAssembly === 'object' &&
    WebAssembly.validate(
      Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00),
    )
  );
}

/**
 * Lazily create a single shared worker and run the one-time `uci` handshake.
 * Reused across moves so we don't pay engine startup on every turn.
 */
function getWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise;

  workerPromise = new Promise<Worker>((resolve, reject) => {
    const src = wasmSupported()
      ? '/stockfish/stockfish.wasm.js'
      : '/stockfish/stockfish.js';
    let worker: Worker;
    try {
      worker = new Worker(src);
    } catch (err) {
      workerPromise = null;
      reject(err as Error);
      return;
    }

    const onReady = (e: MessageEvent) => {
      if (typeof e.data === 'string' && e.data === 'uciok') {
        worker.removeEventListener('message', onReady);
        resolve(worker);
      }
    };
    worker.addEventListener('message', onReady);
    worker.addEventListener('error', (e) => {
      workerPromise = null;
      reject(new Error(e.message));
    });
    worker.postMessage('uci');
  });

  return workerPromise;
}

/**
 * Parse one UCI `info` line into a partial eval. Returns null for `info` lines
 * that carry no usable search data (e.g. `info string ...`, `currmove`).
 *
 * Score is reported from the side-to-move POV by the engine, which already
 * matches the `EngineEval` contract — no sign flip.
 */
export function parseInfoLine(
  line: string,
): (Partial<EngineEval> & { multipv: number }) | null {
  if (!line.startsWith('info ')) return null;
  const tokens = line.split(/\s+/);

  let depth: number | undefined;
  let cp: number | undefined;
  let mate: number | undefined;
  let multipv = 1;
  let pv: string[] | undefined;

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    switch (tok) {
      case 'depth':
        depth = Number(tokens[++i]);
        break;
      case 'multipv':
        multipv = Number(tokens[++i]);
        break;
      case 'score': {
        const kind = tokens[++i];
        const value = Number(tokens[++i]);
        if (kind === 'cp') cp = value;
        else if (kind === 'mate') mate = value;
        break;
      }
      case 'pv':
        // `pv` is always last — the remaining tokens are the line.
        pv = tokens.slice(i + 1);
        i = tokens.length;
        break;
      default:
        break;
    }
  }

  // Without a pv there is no move to report; ignore (e.g. bound-only updates).
  if (!pv || pv.length === 0) return null;

  const result: Partial<EngineEval> & { multipv: number } = {
    bestmove: pv[0],
    pv,
    multipv,
  };
  if (depth !== undefined) result.depth = depth;
  if (cp !== undefined) result.cp = cp;
  if (mate !== undefined) result.mate = mate;
  return result;
}

/** Signed centipawn proxy for a line, treating mate as a large bound. */
function lineCp(line: EngineEval): number {
  if (line.mate !== undefined) {
    return line.mate >= 0
      ? MATE_CP_SENTINEL - line.mate
      : -MATE_CP_SENTINEL - line.mate;
  }
  return line.cp ?? 0;
}

/** Deterministic PRNG (mulberry32) — index picker for the blunder knob. */
function seededIndex(length: number, seed: number): number {
  if (length <= 1) return 0;
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const rnd = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return Math.floor(rnd * length) % length;
}

interface StrengthConfig {
  eloTarget?: number;
  skill?: number;
}

/**
 * Emit the strength `setoption`s. Both modes always toggle UCI_LimitStrength so
 * a prior ELO cap can never leak into a later Skill-mode job on the shared
 * worker.
 */
function applyStrength(worker: Worker, { eloTarget, skill }: StrengthConfig) {
  if (eloTarget !== undefined) {
    const elo = Math.max(UCI_ELO_MIN, Math.min(UCI_ELO_MAX, Math.round(eloTarget)));
    worker.postMessage('setoption name UCI_LimitStrength value true');
    worker.postMessage(`setoption name UCI_Elo value ${elo}`);
  } else {
    worker.postMessage('setoption name UCI_LimitStrength value false');
    worker.postMessage(
      `setoption name Skill Level value ${skill ?? 20}`,
    );
  }
}

interface GoRequest {
  fen: string;
  movetimeMs: number;
  multiPv: number;
  strength: StrengthConfig;
}

/**
 * Core search primitive. Owns the worker for one `go`, collecting `info` lines
 * per multipv index and resolving on `bestmove` with all lines sorted by
 * multipv. Serialized behind `currentJob`; cancellable via `activeJob`.
 */
function runGo(req: GoRequest): Promise<EngineEval[]> {
  const run = currentJob.then(async () => {
    const worker = await getWorker();

    return new Promise<EngineEval[]>((resolve, reject) => {
      const lines = new Map<number, EngineEval>();
      const timeoutMs = Math.max(
        req.movetimeMs + TIMEOUT_BUFFER_MS,
        BESTMOVE_TIMEOUT_MS,
      );

      const cleanup = () => {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        activeJob = null;
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new EngineTimeoutError());
      }, timeoutMs);

      const onMessage = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : '';
        if (line.startsWith('info ')) {
          const parsed = parseInfoLine(line);
          if (parsed) {
            lines.set(parsed.multipv, {
              depth: parsed.depth ?? 0,
              bestmove: parsed.bestmove ?? '',
              pv: parsed.pv ?? [],
              ...(parsed.cp !== undefined ? { cp: parsed.cp } : {}),
              ...(parsed.mate !== undefined ? { mate: parsed.mate } : {}),
            });
          }
          return;
        }
        if (line.startsWith('bestmove ')) {
          cleanup();
          const move = line.split(/\s+/)[1] ?? '';
          if (!move || move === '(none)') {
            reject(new Error('Stockfish returned no legal move'));
            return;
          }
          const ordered = [...lines.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, v]) => v);
          if (ordered.length === 0) {
            // No info captured (very short search) — synthesize from bestmove.
            ordered.push({ depth: 0, bestmove: move, pv: [move] });
          }
          resolve(ordered);
        }
      };

      activeJob = {
        cancel: (err: Error) => {
          cleanup();
          worker.postMessage('stop');
          reject(err);
        },
      };

      worker.addEventListener('message', onMessage);
      worker.postMessage(`setoption name MultiPV value ${req.multiPv}`);
      applyStrength(worker, req.strength);
      worker.postMessage(`position fen ${req.fen}`);
      worker.postMessage(`go movetime ${req.movetimeMs}`);
    });
  });

  // Keep the queue moving whether this job succeeds or fails.
  currentJob = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Resolve top-N eval lines for a position (multipv 1..N, sorted). */
async function analyzeLines(
  fen: string,
  options: EngineAnalysisOptions = {},
): Promise<EngineEval[]> {
  const multiPv = Math.max(1, Math.min(3, options.multiPv ?? 1));
  return runGo({
    fen,
    movetimeMs: options.movetimeMs ?? DEFAULT_MOVETIME_MS,
    multiPv,
    strength: { eloTarget: options.eloTarget, skill: options.skill },
  });
}

/**
 * Analyze a position and resolve the final principal-variation eval.
 *
 * Returns the multipv=1 (objectively best) line. This is analysis, not move
 * selection — the human-like blunder knob lives in `chooseMove` and never
 * changes what `analyze` reports.
 */
export async function analyze(
  fen: string,
  options: EngineAnalysisOptions = {},
): Promise<EngineEval> {
  const lines = await analyzeLines(fen, options);
  return lines[0];
}

/**
 * Pick a move for the side to move, applying the style/blunder knob when set.
 *
 * With `blunderCp` and multiPv>1, eligible lines are those within
 * `[topCp - blunderCp, topCp]` (no better than best, no worse than the window).
 * The pick is deterministic given `deterministicSeed` (default 0 → best line).
 *
 * Unlike `analyze` (which always reports the objectively best line), this is
 * move *selection* — lower-strength bots use it to feel human.
 */
export async function getHumanMove(
  fen: string,
  options: EngineAnalysisOptions = {},
): Promise<string> {
  const wantsBlunder =
    options.blunderCp !== undefined && options.blunderCp > 0;
  const effective: EngineAnalysisOptions = wantsBlunder
    ? { ...options, multiPv: Math.min(3, Math.max(2, options.multiPv ?? 2)) }
    : options;

  const lines = await analyzeLines(fen, effective);
  if (!wantsBlunder || lines.length <= 1) return lines[0].bestmove;

  const topCp = lineCp(lines[0]);
  const window = options.blunderCp ?? 0;
  const eligible = lines.filter((l) => {
    const c = lineCp(l);
    return c <= topCp && c >= topCp - window;
  });
  const pool = eligible.length > 0 ? eligible : lines;
  const idx = seededIndex(pool.length, options.deterministicSeed ?? 0);
  return pool[idx].bestmove;
}

/**
 * Ask Stockfish for the best move from `fen` at the given difficulty level.
 * Returns a UCI move (e.g. "e2e4", or "e7e8q" for a promotion).
 *
 * Backward-compatible: existing callers pass `(fen, level)` and optionally a
 * movetime. Level 1-8 maps to the Skill Level buckets.
 */
export async function getBestMove(
  fen: string,
  level: number,
  movetimeMs = DEFAULT_MOVETIME_MS,
): Promise<string> {
  const skill = UCI_SKILL[(level - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7] ?? 10;
  const lines = await analyzeLines(fen, { skill, movetimeMs });
  return lines[0].bestmove;
}

/**
 * Return the best move (UCI) for the side to move at the given difficulty
 * level. A thin level-aware wrapper over `chooseMove`/`analyze`.
 */
export async function getHint(fen: string, level: number): Promise<string> {
  const skill = UCI_SKILL[(level - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7] ?? 10;
  return getHumanMove(fen, { skill });
}

/**
 * Stop the in-flight search, if any. Sends `stop` to the worker and rejects the
 * pending job with `EngineCancelledError`. The late `bestmove` the engine emits
 * after `stop` is ignored (the listener is already removed) and the queue
 * advances. No-op when idle.
 */
export function cancel(): void {
  activeJob?.cancel(new EngineCancelledError());
}

/**
 * Trigger (or await) the UCI handshake. Resolves once the worker has emitted
 * `uciok`, so callers can warm the engine before the first real search.
 */
export async function warmUp(): Promise<void> {
  await getWorker();
}

/** Test-only: reset module singletons so each test gets a fresh worker. */
export function __resetForTests(): void {
  workerPromise = null;
  currentJob = Promise.resolve();
  activeJob = null;
}
