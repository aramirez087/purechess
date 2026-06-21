import { describe, expect, it } from 'vitest';
import {
  cpLossCoachLine,
  mistakeCoachHref,
  moveLabel,
  plyMeta,
} from '@/lib/chess-com/mistake-coach';

describe('mistake-coach helpers', () => {
  it('formats ply metadata', () => {
    expect(plyMeta(6)).toEqual({ moveNumber: 3, color: 'b' });
    expect(moveLabel(6, 'Nf6')).toBe('3... Nf6');
  });

  it('builds coach deep links', () => {
    expect(mistakeCoachHref({ gameId: 'https://chess.com/game/1', ply: 7 })).toContain(
      'gameId=',
    );
    expect(mistakeCoachHref({ gameId: 'https://chess.com/game/1', ply: 7 })).toContain('ply=7');
  });

  it('describes cp loss in plain language', () => {
    expect(cpLossCoachLine(120)).toContain('pawn');
    expect(cpLossCoachLine(40)).toContain('opening');
  });
});