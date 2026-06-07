import { Injectable } from '@nestjs/common';

const UCI_SKILL = [0, 3, 5, 8, 11, 14, 17, 20] as const;
const BESTMOVE_TIMEOUT_MS = 5000;

export interface StockfishEngine {
  postMessage(cmd: string): void;
  onmessage: ((line: string) => void) | null;
  terminate?: () => void;
}

export type StockfishFactory = () => StockfishEngine;

@Injectable()
export class StockfishService {
  async getBestMove(fen: string, skillLevel: number, movetime = 1000): Promise<string> {
    const skill = UCI_SKILL[(skillLevel - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7] ?? 10;
    const factory = await this.loadFactory();

    return new Promise<string>((resolve, reject) => {
      const engine = factory();

      const timeout = setTimeout(() => {
        engine.terminate?.();
        reject(new Error('Stockfish timeout: no bestmove within 5 seconds'));
      }, BESTMOVE_TIMEOUT_MS);

      engine.onmessage = (line: string) => {
        if (line === 'uciok') {
          engine.postMessage(`setoption name Skill Level value ${skill}`);
          engine.postMessage('isready');
        } else if (line === 'readyok') {
          engine.postMessage(`position fen ${fen}`);
          engine.postMessage(`go movetime ${movetime}`);
        } else if (line.startsWith('bestmove ')) {
          clearTimeout(timeout);
          engine.terminate?.();
          const move = line.split(' ')[1] ?? '';
          if (move === '(none)' || move === '') {
            reject(new Error('Stockfish returned no legal move'));
          } else {
            resolve(move);
          }
        }
      };

      engine.postMessage('uci');
    });
  }

  protected async loadFactory(): Promise<StockfishFactory> {
    const mod = await import('stockfish');
    return ((mod as { default?: StockfishFactory }).default ?? mod) as StockfishFactory;
  }
}
