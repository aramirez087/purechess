import { EngineMove } from '@purchess/shared';

export interface PgnHeaders {
  event?: string;
  site?: string;
  date?: string;
  white: string;
  black: string;
  result: string;
  timeControl?: string;
  whiteElo?: number;
  blackElo?: number;
  eco?: string;
}

export function buildPgn(moves: EngineMove[], headers: PgnHeaders): string {
  const lines: string[] = [];

  lines.push(`[Event "${headers.event ?? '?'}"]`);
  lines.push(`[Site "${headers.site ?? 'Purchess'}"]`);
  lines.push(`[Date "${headers.date ?? '????.??.??'}"]`);
  lines.push(`[White "${headers.white}"]`);
  lines.push(`[Black "${headers.black}"]`);
  lines.push(`[Result "${headers.result}"]`);
  if (headers.timeControl !== undefined) {
    lines.push(`[TimeControl "${headers.timeControl}"]`);
  }
  if (headers.whiteElo !== undefined) {
    lines.push(`[WhiteElo "${headers.whiteElo}"]`);
  }
  if (headers.blackElo !== undefined) {
    lines.push(`[BlackElo "${headers.blackElo}"]`);
  }
  if (headers.eco !== undefined) {
    lines.push(`[ECO "${headers.eco}"]`);
  }

  lines.push('');

  if (moves.length === 0) {
    lines.push(headers.result);
    return lines.join('\n');
  }

  const moveParts: string[] = [];
  let firstBlackNeedsPrefix = moves[0]?.by === 'b';

  for (const move of moves) {
    const fullmoveNumber = Math.ceil(move.ply / 2);
    if (move.by === 'w') {
      moveParts.push(`${fullmoveNumber}. ${move.san}`);
      firstBlackNeedsPrefix = false;
    } else {
      if (firstBlackNeedsPrefix) {
        moveParts.push(`${fullmoveNumber}... ${move.san}`);
        firstBlackNeedsPrefix = false;
      } else {
        moveParts.push(move.san);
      }
    }
  }

  moveParts.push(headers.result);
  lines.push(moveParts.join(' '));

  return lines.join('\n');
}
