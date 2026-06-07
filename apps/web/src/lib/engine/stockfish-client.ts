'use client';

/**
 * Client-side Stockfish wrapper.
 *
 * Vs-computer games are unrated, so the engine runs in the browser in a Web
 * Worker (assets under /public/stockfish). The server only validates and
 * records moves — it never runs an engine. This ports the UCI handshake that
 * used to live in the API's stockfish.service.ts to the browser, where
 * `postMessage` actually exists.
 */

// Difficulty level (1-8) -> UCI "Skill Level" (0-20).
const UCI_SKILL = [0, 3, 5, 8, 11, 14, 17, 20] as const;

const BESTMOVE_TIMEOUT_MS = 10_000;

let workerPromise: Promise<Worker> | null = null;

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
    worker.addEventListener('error', (e) => reject(new Error(e.message)));
    worker.postMessage('uci');
  });

  return workerPromise;
}

/**
 * Ask Stockfish for the best move from `fen` at the given difficulty level.
 * Returns a UCI move (e.g. "e2e4", or "e7e8q" for a promotion).
 */
export async function getBestMove(
  fen: string,
  level: number,
  movetimeMs = 1000,
): Promise<string> {
  const skill = UCI_SKILL[(level - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7] ?? 10;
  const worker = await getWorker();

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.removeEventListener('message', onMessage);
      reject(new Error('Stockfish timeout: no bestmove'));
    }, BESTMOVE_TIMEOUT_MS);

    const onMessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : '';
      if (line.startsWith('bestmove ')) {
        clearTimeout(timeout);
        worker.removeEventListener('message', onMessage);
        const move = line.split(' ')[1] ?? '';
        if (!move || move === '(none)') {
          reject(new Error('Stockfish returned no legal move'));
        } else {
          resolve(move);
        }
      }
    };

    worker.addEventListener('message', onMessage);
    worker.postMessage(`setoption name Skill Level value ${skill}`);
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go movetime ${movetimeMs}`);
  });
}
