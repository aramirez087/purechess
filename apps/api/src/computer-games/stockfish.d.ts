declare module 'stockfish' {
  interface StockfishEngine {
    postMessage(cmd: string): void;
    onmessage: ((line: string) => void) | null;
    terminate?: () => void;
  }
  function stockfish(): StockfishEngine;
  export = stockfish;
}
