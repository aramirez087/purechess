import {
  ENDGAME_GAP_MIN_UNSOLVED,
  OPENING_LEAK_MIN_LAPSES,
  chessComOpeningWeakness,
  pickStrongerOpeningWeakness,
  RECURRING_MISTAKE_MIN,
  THEME_MIN_ATTEMPTS,
  THEME_WEAK_ACCURACY,
  TIME_FAST_MOVE_MIN_SAMPLE,
  endgameGap,
  humanize,
  openingLeak,
  recurringGameMistake,
  tacticalThemeWeakness,
  themeCommonness,
  timeManagement,
  type EndgameCategoryStat,
  type MistakeCluster,
  type MoveTimeAgg,
  type RepertoireOutcome,
  type ThemeStat,
} from '../../src/insights/weakness-detectors';
import {
  rankWeaknesses,
  score,
} from '../../src/insights/insights.service';
import type { WeaknessDto } from '@purechess/shared';

// ---------------------------------------------------------------------------
// tacticalThemeWeakness
// ---------------------------------------------------------------------------

describe('tacticalThemeWeakness', () => {
  it('fires on a clear weak theme with enough volume', () => {
    const stats: ThemeStat[] = [
      { slug: 'fork', attempts: 47, accuracy: 0.38 },
      { slug: 'pin', attempts: 50, accuracy: 0.9 },
    ];
    const w = tacticalThemeWeakness(stats);
    expect(w).not.toBeNull();
    expect(w!.slug).toBe('fork');
    expect(w!.kind).toBe('theme');
    expect(w!.area).toBe('theme');
    expect(w!.actionHref).toBe('/puzzles/train?theme=fork');
    expect(w!.evidence).toContain('38%');
    expect(w!.evidence).toContain('47');
    expect(w!.severity).toBeGreaterThan(0);
    expect(w!.severity).toBeLessThanOrEqual(1);
    expect(w!.accuracy).toBeCloseTo(0.38);
    expect(w!.sampleSize).toBe(47);
    expect(w!.estimatedEloUpside).toBeGreaterThan(0);
  });

  it('stays silent when no theme is below the weak band (noise)', () => {
    const stats: ThemeStat[] = [
      { slug: 'fork', attempts: 40, accuracy: 0.82 },
      { slug: 'pin', attempts: 60, accuracy: 0.75 },
    ];
    expect(tacticalThemeWeakness(stats)).toBeNull();
  });

  it('stays silent on a weak theme with insufficient attempts', () => {
    const stats: ThemeStat[] = [
      { slug: 'fork', attempts: THEME_MIN_ATTEMPTS - 1, accuracy: 0.1 },
    ];
    expect(tacticalThemeWeakness(stats)).toBeNull();
  });

  it('ignores themes with undefined accuracy', () => {
    const stats: ThemeStat[] = [
      { slug: 'fork', attempts: 30, accuracy: undefined },
    ];
    expect(tacticalThemeWeakness(stats)).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(tacticalThemeWeakness([])).toBeNull();
  });

  it('weights by commonness: a weak common motif beats a slightly-weaker rare one', () => {
    // enPassant is rarer/less-leveraged than fork; even a touch lower accuracy on
    // enPassant should NOT outrank a clearly-weak fork once commonness is applied.
    const stats: ThemeStat[] = [
      { slug: 'fork', attempts: 40, accuracy: 0.45 }, // gap .55 × ~1.0 = .55
      { slug: 'enPassant', attempts: 40, accuracy: 0.4 }, // gap .60 × ~0.2 = .12
    ];
    const w = tacticalThemeWeakness(stats);
    expect(w!.slug).toBe('fork');
  });

  it('a more severe theme yields higher severity than a borderline one', () => {
    const severe = tacticalThemeWeakness([
      { slug: 'fork', attempts: 30, accuracy: 0.3 },
    ]);
    const mild = tacticalThemeWeakness([
      { slug: 'fork', attempts: 30, accuracy: 0.64 },
    ]);
    expect(severe!.severity).toBeGreaterThan(mild!.severity!);
  });

  it('uses the provided label when present', () => {
    const w = tacticalThemeWeakness([
      { slug: 'backRankMate', label: 'Back-rank mates', attempts: 30, accuracy: 0.4 },
    ]);
    expect(w!.label).toBe('Back-rank mates');
    expect(w!.title).toContain('Back-rank mates');
  });

  it('fires exactly at the weak-accuracy boundary (inclusive)', () => {
    const w = tacticalThemeWeakness([
      { slug: 'fork', attempts: 30, accuracy: THEME_WEAK_ACCURACY },
    ]);
    expect(w).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// recurringGameMistake
// ---------------------------------------------------------------------------

describe('recurringGameMistake', () => {
  it('fires when a theme cluster clears the floor', () => {
    const clusters: MistakeCluster[] = [
      { theme: 'fork', count: 4, totalMistakes: 10 },
      { theme: 'pin', count: 1, totalMistakes: 10 },
    ];
    const w = recurringGameMistake(clusters);
    expect(w).not.toBeNull();
    expect(w!.slug).toBe('fork');
    expect(w!.kind).toBe('game-mistake');
    expect(w!.area).toBe('theme');
    expect(w!.title.toLowerCase()).toContain('costing you games');
    expect(w!.evidence).toContain('4');
    expect(w!.actionHref).toBe('/puzzles/train?theme=fork');
    expect(w!.sampleSize).toBe(4);
  });

  it('stays silent below the recurring floor (one-off mistake)', () => {
    const clusters: MistakeCluster[] = [
      { theme: 'fork', count: RECURRING_MISTAKE_MIN - 1, totalMistakes: 10 },
    ];
    expect(recurringGameMistake(clusters)).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(recurringGameMistake([])).toBeNull();
  });

  it('picks the largest cluster, then commonness on a tie', () => {
    const clusters: MistakeCluster[] = [
      { theme: 'enPassant', count: 5, totalMistakes: 20 },
      { theme: 'fork', count: 5, totalMistakes: 20 },
    ];
    // Same count → commonness tie-break → fork (more common).
    expect(recurringGameMistake(clusters)!.slug).toBe('fork');
  });

  it('severity rises with cluster size', () => {
    const small = recurringGameMistake([{ theme: 'fork', count: 3, totalMistakes: 10 }]);
    const big = recurringGameMistake([{ theme: 'fork', count: 8, totalMistakes: 10 }]);
    expect(big!.severity).toBeGreaterThan(small!.severity!);
  });
});

// ---------------------------------------------------------------------------
// openingLeak
// ---------------------------------------------------------------------------

describe('openingLeak', () => {
  it('fires when a line lapses past the floor', () => {
    const outcomes: RepertoireOutcome[] = [
      { label: 'Najdorf', repertoireId: 'rep1', lapses: 4, reps: 6 },
      { label: 'Caro-Kann', repertoireId: 'rep2', lapses: 1, reps: 8 },
    ];
    const w = openingLeak(outcomes);
    expect(w).not.toBeNull();
    expect(w!.label).toBe('Najdorf');
    expect(w!.kind).toBe('opening');
    expect(w!.area).toBe('opening');
    expect(w!.actionHref).toBe('/openings?repertoire=rep1');
    expect(w!.evidence).toContain('drill');
    expect(w!.sampleSize).toBe(6);
  });

  it('stays silent below the lapse floor', () => {
    const outcomes: RepertoireOutcome[] = [
      { label: 'Najdorf', repertoireId: 'rep1', lapses: OPENING_LEAK_MIN_LAPSES - 1, reps: 6 },
    ];
    expect(openingLeak(outcomes)).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(openingLeak([])).toBeNull();
  });

  it('ranks by lapse count then lapse rate', () => {
    const outcomes: RepertoireOutcome[] = [
      { label: 'A', repertoireId: 'a', lapses: 5, reps: 20 }, // rate .25
      { label: 'B', repertoireId: 'b', lapses: 5, reps: 10 }, // rate .5 → wins on tie
    ];
    expect(openingLeak(outcomes)!.label).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// chessComOpeningWeakness
// ---------------------------------------------------------------------------

describe('chessComOpeningWeakness', () => {
  it('fires when one opening has enough mistakes', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1';
    const w = chessComOpeningWeakness([
      { openingLabel: 'Italian Game', cpLoss: 120, fen },
      { openingLabel: 'Italian Game', cpLoss: 90, fen },
    ]);
    expect(w).not.toBeNull();
    expect(w!.label).toBe('Italian Game');
    expect(w!.actionHref).toContain('/openings/lab?');
    expect(w!.actionHref).toContain('q=Italian+Game');
    expect(w!.actionHref).toContain('fen=');
    expect(w!.evidence).toContain('chess.com');
  });

  it('stays silent below the mistake floor', () => {
    expect(
      chessComOpeningWeakness([
        { openingLabel: 'Italian Game', cpLoss: 120 },
      ]),
    ).toBeNull();
    expect(chessComOpeningWeakness([])).toBeNull();
  });
});

describe('pickStrongerOpeningWeakness', () => {
  it('prefers the higher-severity opening signal', () => {
    const repertoire = {
      area: 'opening' as const,
      label: 'Rep',
      severity: 0.4,
    };
    const chessCom = {
      area: 'opening' as const,
      label: 'Italian',
      severity: 0.8,
    };
    expect(pickStrongerOpeningWeakness(repertoire, chessCom)?.label).toBe('Italian');
  });
});

// ---------------------------------------------------------------------------
// endgameGap
// ---------------------------------------------------------------------------

describe('endgameGap', () => {
  it('fires when a category has enough attempted-but-unsolved drills', () => {
    const stats: EndgameCategoryStat[] = [
      { category: 'rook', unsolved: 3, attempted: 4 },
      { category: 'king_pawn', unsolved: 0, attempted: 5 },
    ];
    const w = endgameGap(stats);
    expect(w).not.toBeNull();
    expect(w!.slug).toBe('rook');
    expect(w!.kind).toBe('endgame');
    expect(w!.area).toBe('endgame');
    expect(w!.actionHref).toBe('/endgames?category=rook');
    expect(w!.label).toBe('Rook endgames');
    expect(w!.evidence).toContain('1/4'); // 1 solved of 4
    expect(w!.sampleSize).toBe(4);
  });

  it('stays silent below the unsolved floor (one failed drill is noise)', () => {
    const stats: EndgameCategoryStat[] = [
      { category: 'rook', unsolved: ENDGAME_GAP_MIN_UNSOLVED - 1, attempted: 5 },
    ];
    expect(endgameGap(stats)).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(endgameGap([])).toBeNull();
  });

  it('ranks by unsolved count then miss rate', () => {
    const stats: EndgameCategoryStat[] = [
      { category: 'rook', unsolved: 3, attempted: 10 }, // rate .3
      { category: 'minor', unsolved: 3, attempted: 4 }, // rate .75 → wins on tie
    ];
    expect(endgameGap(stats)!.slug).toBe('minor');
  });
});

// ---------------------------------------------------------------------------
// timeManagement — the conservative detector
// ---------------------------------------------------------------------------

function baseAgg(over: Partial<MoveTimeAgg> = {}): MoveTimeAgg {
  return {
    fastMoves: 0,
    fastBlunders: 0,
    totalClassifiedMoves: 0,
    totalBlunders: 0,
    decisiveGames: 0,
    flagLosses: 0,
    ...over,
  };
}

describe('timeManagement', () => {
  it('fires on clear fast-move blundering vs baseline', () => {
    const w = timeManagement(
      baseAgg({
        fastMoves: 40,
        fastBlunders: 16, // 40% on fast moves
        totalClassifiedMoves: 200,
        totalBlunders: 24, // 12% overall → fast is >2× baseline
      }),
    );
    expect(w).not.toBeNull();
    expect(w!.area).toBe('time');
    expect(w!.kind).toBe('time');
    expect(w!.evidence).toContain('%');
    expect(w!.actionHref).toBe('/play');
    expect(w!.severity).toBeGreaterThan(0);
  });

  it('fires on chronic flag losses', () => {
    const w = timeManagement(
      baseAgg({
        decisiveGames: 20,
        flagLosses: 6, // 30%
      }),
    );
    expect(w).not.toBeNull();
    expect(w!.title.toLowerCase()).toContain('clock');
    expect(w!.evidence).toContain('6');
    expect(w!.sampleSize).toBe(20);
  });

  // --- conservative: stays silent on thin / ambiguous data --------------------

  it('does NOT fire on thin fast-move sample even at a high rate', () => {
    const w = timeManagement(
      baseAgg({
        fastMoves: TIME_FAST_MOVE_MIN_SAMPLE - 1,
        fastBlunders: TIME_FAST_MOVE_MIN_SAMPLE - 1, // 100% but tiny sample
        totalClassifiedMoves: TIME_FAST_MOVE_MIN_SAMPLE - 1,
        totalBlunders: TIME_FAST_MOVE_MIN_SAMPLE - 1,
      }),
    );
    expect(w).toBeNull();
  });

  it('does NOT fire when fast-move blunder rate matches the baseline (uniformly blundery, not a TIME problem)', () => {
    const w = timeManagement(
      baseAgg({
        fastMoves: 50,
        fastBlunders: 15, // 30% on fast
        totalClassifiedMoves: 200,
        totalBlunders: 60, // 30% overall — same as fast, so NOT a speed issue
      }),
    );
    expect(w).toBeNull();
  });

  it('does NOT fire when fast blunder rate is below the absolute floor', () => {
    const w = timeManagement(
      baseAgg({
        fastMoves: 50,
        fastBlunders: 5, // 10% — below TIME_FAST_BLUNDER_RATE even if 5× baseline
        totalClassifiedMoves: 500,
        totalBlunders: 10, // 2% baseline
      }),
    );
    expect(w).toBeNull();
  });

  it('does NOT fire on thin decisive-game sample even at a high flag rate', () => {
    const w = timeManagement(
      baseAgg({
        decisiveGames: 4,
        flagLosses: 3, // 75% but only 4 games
      }),
    );
    expect(w).toBeNull();
  });

  it('does NOT fire on a single flag loss over many games (one unlucky flag)', () => {
    const w = timeManagement(
      baseAgg({
        decisiveGames: 30,
        flagLosses: 1,
      }),
    );
    expect(w).toBeNull();
  });

  it('does NOT fire on empty/zero data', () => {
    expect(timeManagement(baseAgg())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ranking (severity × impact) + dedupe
// ---------------------------------------------------------------------------

describe('rankWeaknesses', () => {
  function w(over: Partial<WeaknessDto>): WeaknessDto {
    return { area: 'theme', label: 'x', ...over };
  }

  it('orders by severity × impact, strongest first', () => {
    const a = w({ kind: 'theme', label: 'A', severity: 0.9, estimatedEloUpside: 50 }); // 45
    const b = w({ kind: 'opening', label: 'B', severity: 0.4, estimatedEloUpside: 40 }); // 16
    const c = w({ kind: 'endgame', label: 'C', severity: 0.8, estimatedEloUpside: 60 }); // 48
    const ranked = rankWeaknesses([a, b, c]);
    expect(ranked.map((x) => x.label)).toEqual(['C', 'A', 'B']);
  });

  it('drops nulls', () => {
    const a = w({ kind: 'theme', severity: 0.5, estimatedEloUpside: 20 });
    expect(rankWeaknesses([null, a, null])).toHaveLength(1);
  });

  it('dedupes by kind, keeping the strongest per domain', () => {
    const weak = w({ kind: 'theme', label: 'weak-theme', severity: 0.3, estimatedEloUpside: 10 }); // 3
    const strong = w({ kind: 'theme', label: 'strong-theme', severity: 0.9, estimatedEloUpside: 50 }); // 45
    const ranked = rankWeaknesses([weak, strong]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].label).toBe('strong-theme');
  });

  it('does NOT collapse game-mistake and theme into one (distinct kinds)', () => {
    const theme = w({ kind: 'theme', label: 't', severity: 0.5, estimatedEloUpside: 20 });
    const mistake = w({ kind: 'game-mistake', label: 'm', severity: 0.5, estimatedEloUpside: 20 });
    expect(rankWeaknesses([theme, mistake])).toHaveLength(2);
  });

  it('a high-impact, low-severity weakness can outrank a low-impact high-severity one', () => {
    const lowSevHighImpact = w({ kind: 'theme', label: 'L', severity: 0.5, estimatedEloUpside: 60 }); // 30
    const highSevLowImpact = w({ kind: 'opening', label: 'H', severity: 0.9, estimatedEloUpside: 10 }); // 9
    expect(rankWeaknesses([lowSevHighImpact, highSevLowImpact])[0].label).toBe('L');
  });

  it('score defaults impact to 10 when absent', () => {
    expect(score({ area: 'theme', label: 'x', severity: 0.5 })).toBe(5);
    expect(score({ area: 'theme', label: 'x' })).toBe(0);
  });

  it('returns [] on all-null input', () => {
    expect(rankWeaknesses([null, null])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

describe('themeCommonness + humanize', () => {
  it('weights common motifs above rare ones', () => {
    expect(themeCommonness('fork')).toBeGreaterThan(themeCommonness('enPassant'));
  });

  it('defaults unmapped themes to a mid weight', () => {
    expect(themeCommonness('someBrandNewMotif')).toBe(0.6);
  });

  it('humanizes camelCase and snake_case slugs', () => {
    expect(humanize('backRankMate')).toBe('Back rank mate');
    expect(humanize('king_pawn')).toBe('King pawn');
  });
});
