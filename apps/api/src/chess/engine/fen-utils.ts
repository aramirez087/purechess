import { Chess } from 'chess.js';

export function startingFen(): string {
  return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
}

export function fenPosition(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function halfmoveClock(fen: string): number {
  return parseInt(fen.split(' ')[4] ?? '0', 10);
}

export function toFen(chess: Chess): string {
  return chess.fen();
}
