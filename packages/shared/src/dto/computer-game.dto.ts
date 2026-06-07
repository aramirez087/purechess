export interface CreateComputerGameDto {
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  color: 'white' | 'black' | 'random';
  timeControlSeconds: number;
  incrementSeconds?: number;
}

export interface ComputerMoveDto {
  move: string;
}

export interface ComputerGameStateDto {
  gameId: string;
  fen: string;
  pgn: string;
  status: string;
  computerColor: 'white' | 'black';
  computerLevel: number;
  lastComputerMove: string | null;
  result: string | null;
  resultReason: string | null;
}
