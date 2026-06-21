import type { WeaknessDto } from '@purechess/shared';

/**
 * Pure weakness detectors. Each takes ALREADY-AGGREGATED inputs (so the service
 * does the DB reads, the detectors do only the reasoning) and returns a
 * {@link WeaknessDto} or `null`. Null means "no clear signal" — every detector
 * is deliberately CONSERVATIVE: it fires only with enough volume and a clear
 * gap, never on a one-off miss or thin data. This file is the trust-critical
 * core; it is exhaustively unit-tested on positive + negative + thin-data cases.
 *
 * A weakness carries:
 *   - `kind`        — the source domain (drives icon/route on the card)
 *   - `title`       — plain-language headline ("Forks are costing you games")
 *   - `evidence`    — one line WITH the numbers ("38% on forks over 47 puzzles")
 *   - `severity`    — 0..1, how weak / urgent (higher = weaker)
 *   - `actionHref`  — deep link to the drill that fixes it
 *   - `estimatedEloUpside` — heuristic rating points on the table (the IMPACT
 *     term the service multiplies severity by when ranking)
 *
 * Severity and impact are kept SEPARATE: severity is how bad this specific gap
 * is; impact (estimatedEloUpside, weighted by how common/relevant the area is)
 * is how much fixing it would move the user's rating. The service ranks by
 * `severity × impact` (see {@link InsightsService}).
 */

// ---------------------------------------------------------------------------
// Shared thresholds (exported so the service + tests reference the same numbers)
// ---------------------------------------------------------------------------

/** A puzzle theme needs at least this many attempts to be eligible. */
export const THEME_MIN_ATTEMPTS = 15;

/** A theme only counts as a weakness when accuracy is at/below this band. */
export const THEME_WEAK_ACCURACY = 0.65;

/** Below this accuracy a theme is treated as a severe gap (max severity floor). */
export const THEME_SEVERE_ACCURACY = 0.4;

/** Minimum same-theme mistakes in the user's games before it's a "recurring" cluster. */
export const RECURRING_MISTAKE_MIN = 3;

/** A repertoire line needs this many lapses before it's a flagged "opening leak". */
export const OPENING_LEAK_MIN_LAPSES = 3;

/** chess.com opening mistakes in one motif before it surfaces as a weakness. */
export const CHESSCOM_OPENING_MIN_MISTAKES = 2;

/** An endgame category needs this many attempted-but-unsolved drills to be a gap. */
export const ENDGAME_GAP_MIN_UNSOLVED = 2;

/** Time-management: minimum fast-move sample before the fast-blunder signal can fire. */
export const TIME_FAST_MOVE_MIN_SAMPLE = 20;

/** Time-management: a move under this many ms is "fast" (a reflex / premove-speed move). */
export const TIME_FAST_MOVE_MS = 3000;

/** Time-management: fast moves must blunder at least this often (vs the user's baseline) to fire. */
export const TIME_FAST_BLUNDER_RATE = 0.25;

/** Time-management: minimum flagged-loss sample + share before the flag signal fires. */
export const TIME_FLAG_MIN_GAMES = 10;
export const TIME_FLAG_LOSS_RATE = 0.25;

// ---------------------------------------------------------------------------
// Aggregated input shapes (the service builds these; the detectors only reason)
// ---------------------------------------------------------------------------

/** Per-theme puzzle accuracy roll-up (a subset of `PuzzleThemeStatDto`). */
export interface ThemeStat {
  slug: string;
  label?: string;
  attempts: number;
  /** solved / attempts, 0..1. */
  accuracy?: number;
}

/** A cluster of same-theme mistakes mined from the user's own games. */
export interface MistakeCluster {
  /** Tactical theme the mistakes share, e.g. "fork". */
  theme: string;
  /** How many of the user's recent game-mistakes carried this theme. */
  count: number;
  /** Total game-mistakes considered (the denominator for "how often"). */
  totalMistakes: number;
}

/** Minimal chess.com opening mistake shape for clustering (insights read model). */
export interface ChessComMistakeSummary {
  openingLabel: string;
  cpLoss: number;
  playedAt?: string;
  /** Position at the mistake — used to deep-link Opening Lab to the right line. */
  fen?: string;
}

/** A repertoire line the user keeps missing (an "opening leak"). */
export interface RepertoireOutcome {
  /** Human label for the opening/line, e.g. "Najdorf — 6.Bg5". */
  label: string;
  /** Repertoire id the line belongs to (for the deep link). */
  repertoireId: string;
  /** Times the user has lapsed (re-failed) this line. */
  lapses: number;
  /** Times the line has been drilled (the denominator). */
  reps: number;
}

/** Per-category endgame attempt roll-up. */
export interface EndgameCategoryStat {
  /** Endgame family, e.g. "rook", "king_pawn". */
  category: string;
  /** Drills in this category the user has attempted but never solved. */
  unsolved: number;
  /** Drills in this category the user has attempted at all. */
  attempted: number;
}

/** Time-management aggregates over the user's own moves/games (read-only). */
export interface MoveTimeAgg {
  /** Moves the user spent < TIME_FAST_MOVE_MS on. */
  fastMoves: number;
  /** Of those fast moves, how many were blunders (cpLoss over the mistake band). */
  fastBlunders: number;
  /** ALL of the user's classified moves (the baseline blunder rate denominator). */
  totalClassifiedMoves: number;
  /** Of all classified moves, how many were blunders (the baseline). */
  totalBlunders: number;
  /** Decisive games the user finished (won or lost). */
  decisiveGames: number;
  /** Of those, how many the user LOST on the clock (flagged). */
  flagLosses: number;
}

// ---------------------------------------------------------------------------
// Theme commonness weighting (a weak 'fork' matters more than a weak 'enPassant')
// ---------------------------------------------------------------------------

/**
 * How common / high-leverage a tactical theme is, 0..1. A weakness in a common
 * motif (fork, pin, back-rank) is worth more rating than the same accuracy gap
 * in a rare one (en passant, underpromotion). Unlisted themes default to a
 * mid weight so a real but unmapped weakness still surfaces.
 */
const THEME_COMMONNESS: Record<string, number> = {
  fork: 1,
  pin: 0.95,
  hangingPiece: 0.95,
  backRankMate: 0.9,
  skewer: 0.85,
  discoveredAttack: 0.85,
  doubleCheck: 0.6,
  mateIn1: 0.9,
  mateIn2: 0.8,
  mateIn3: 0.6,
  deflection: 0.7,
  sacrifice: 0.65,
  promotion: 0.55,
  zugzwang: 0.4,
  enPassant: 0.2,
  underpromotion: 0.15,
  capturingDefender: 0.6,
  trappedPiece: 0.7,
  intermezzo: 0.55,
  attraction: 0.6,
  clearance: 0.45,
  interference: 0.4,
};

const DEFAULT_COMMONNESS = 0.6;

/** The commonness weight for a theme slug (mid default for unmapped slugs). */
export function themeCommonness(slug: string): number {
  return THEME_COMMONNESS[slug] ?? DEFAULT_COMMONNESS;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function pct(n: number): number {
  return Math.round(n * 100);
}

/** Title-case a theme/category slug for display, e.g. "backRankMate" → "Back rank mate". */
export function humanize(slug: string): string {
  const spaced = slug
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

/**
 * Worst puzzle theme by accuracy, among themes with enough volume. Fires only
 * when a theme has ≥ {@link THEME_MIN_ATTEMPTS} attempts AND accuracy at/below
 * {@link THEME_WEAK_ACCURACY}. When multiple qualify, the one whose
 * `(1 - accuracy) × commonness` is largest wins — a weak common motif beats a
 * slightly-weaker rare one. Returns `null` on thin data / no weak theme.
 */
export function tacticalThemeWeakness(themeStats: ThemeStat[]): WeaknessDto | null {
  const eligible = themeStats.filter(
    (t) =>
      t.attempts >= THEME_MIN_ATTEMPTS &&
      typeof t.accuracy === 'number' &&
      t.accuracy <= THEME_WEAK_ACCURACY,
  );
  if (eligible.length === 0) return null;

  // Score = gap × commonness. Pick the largest; tie-break larger sample, then slug.
  const ranked = [...eligible].sort((a, b) => {
    const sa = (1 - (a.accuracy as number)) * themeCommonness(a.slug);
    const sb = (1 - (b.accuracy as number)) * themeCommonness(b.slug);
    if (sa !== sb) return sb - sa;
    if (a.attempts !== b.attempts) return b.attempts - a.attempts;
    return a.slug.localeCompare(b.slug);
  });
  const worst = ranked[0];
  const accuracy = worst.accuracy as number;
  const name = worst.label ?? humanize(worst.slug);
  const common = themeCommonness(worst.slug);

  // Severity scales the gap below the weak band onto 0..1, with the severe band
  // pinning it near 1. A 65% theme is a mild weakness (~0); a ≤40% theme is severe.
  const severity = clamp01(
    (THEME_WEAK_ACCURACY - accuracy) / (THEME_WEAK_ACCURACY - THEME_SEVERE_ACCURACY),
  );

  return {
    area: 'theme',
    kind: 'theme',
    slug: worst.slug,
    label: name,
    title: `${name} puzzles are your weakest tactic`,
    evidence: `${pct(accuracy)}% accuracy on ${name.toLowerCase()} over ${worst.attempts} puzzles`,
    severity,
    actionHref: `/puzzles/train?theme=${encodeURIComponent(worst.slug)}`,
    accuracy,
    sampleSize: worst.attempts,
    // Impact: common motifs are worth more rating to fix. ~10–60 ELO heuristic.
    estimatedEloUpside: Math.round(10 + severity * common * 50),
  };
}

/**
 * The tactical motif the user repeatedly blunders into in REAL games. Fires when
 * a single theme accounts for ≥ {@link RECURRING_MISTAKE_MIN} of the user's
 * recent game-mistakes — these cost actual rating, so they outrank a puzzle gap
 * of the same motif. Picks the largest cluster (tie-break by commonness).
 * Returns `null` when no cluster clears the floor.
 */
export function recurringGameMistake(clusters: MistakeCluster[]): WeaknessDto | null {
  const eligible = clusters.filter((c) => c.count >= RECURRING_MISTAKE_MIN);
  if (eligible.length === 0) return null;

  const ranked = [...eligible].sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    const ca = themeCommonness(a.theme);
    const cb = themeCommonness(b.theme);
    if (ca !== cb) return cb - ca;
    return a.theme.localeCompare(b.theme);
  });
  const top = ranked[0];
  const name = humanize(top.theme);
  const common = themeCommonness(top.theme);

  // Severity rises with how dominant the cluster is, capped. 3 mistakes ⇒ ~0.5,
  // 6+ ⇒ ~1. Real-game mistakes are weighted heavier than puzzle gaps.
  const severity = clamp01(top.count / 6);

  return {
    area: 'theme',
    kind: 'game-mistake',
    slug: top.theme,
    label: name,
    title: `${name}s are costing you games`,
    evidence:
      `You missed ${top.count} ${name.toLowerCase()}${top.count === 1 ? '' : 's'} ` +
      `across your recent games`,
    severity,
    actionHref: `/puzzles/train?theme=${encodeURIComponent(top.theme)}`,
    sampleSize: top.count,
    // Impact: a recurring real-game blunder is high-leverage; common motifs more so.
    estimatedEloUpside: Math.round(20 + severity * common * 50),
  };
}

/**
 * The opening line the user keeps leaving book on. Fires when a repertoire line
 * has ≥ {@link OPENING_LEAK_MIN_LAPSES} lapses (re-failures). Picks the most-
 * lapsed line (tie-break by lapse RATE, then label). Returns `null` when no line
 * has leaked enough.
 */
/**
 * Recurring opening mistakes mined from the user's chess.com games (client-side
 * engine analysis of the opening phase). Fires when one opening motif has ≥
 * {@link CHESSCOM_OPENING_MIN_MISTAKES} mistakes. Picks the cluster with the
 * highest count (tie-break by average cp loss).
 */
export function chessComOpeningWeakness(
  mistakes: ChessComMistakeSummary[],
): WeaknessDto | null {
  if (mistakes.length < CHESSCOM_OPENING_MIN_MISTAKES) return null;

  const byLabel = new Map<string, ChessComMistakeSummary[]>();
  for (const m of mistakes) {
    const bucket = byLabel.get(m.openingLabel) ?? [];
    bucket.push(m);
    byLabel.set(m.openingLabel, bucket);
  }

  const clusters = [...byLabel.entries()]
    .map(([openingLabel, items]) => {
      const worst = [...items].sort((a, b) => b.cpLoss - a.cpLoss)[0]!;
      return {
        openingLabel,
        count: items.length,
        avgCp: items.reduce((s, m) => s + m.cpLoss, 0) / items.length,
        fen: worst.fen,
      };
    })
    .filter((c) => c.count >= CHESSCOM_OPENING_MIN_MISTAKES)
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return b.avgCp - a.avgCp;
    });

  if (clusters.length === 0) return null;

  const top = clusters[0];
  const severity = clamp01(top.count / 5 + top.avgCp / 400);
  const params = new URLSearchParams({ q: top.openingLabel });
  if (top.fen) params.set('fen', top.fen);

  return {
    area: 'opening',
    kind: 'opening',
    slug: encodeURIComponent(top.openingLabel),
    label: top.openingLabel,
    title: `Opening mistakes in your ${top.openingLabel} games`,
    evidence:
      `${top.count} mistake${top.count === 1 ? '' : 's'} in the opening ` +
      `from chess.com — avg ${Math.round(top.avgCp)}cp lost`,
    severity,
    actionHref: `/openings/lab?${params.toString()}`,
    sampleSize: top.count,
    estimatedEloUpside: Math.round(15 + severity * 45),
  };
}

/** Pick the stronger of two opening weaknesses (repertoire leak vs chess.com). */
export function pickStrongerOpeningWeakness(
  repertoire: WeaknessDto | null,
  chessCom: WeaknessDto | null,
): WeaknessDto | null {
  if (!repertoire) return chessCom;
  if (!chessCom) return repertoire;
  return (repertoire.severity ?? 0) >= (chessCom.severity ?? 0) ? repertoire : chessCom;
}

export function openingLeak(outcomes: RepertoireOutcome[]): WeaknessDto | null {
  const eligible = outcomes.filter((o) => o.lapses >= OPENING_LEAK_MIN_LAPSES);
  if (eligible.length === 0) return null;

  const rateOf = (o: RepertoireOutcome) => (o.reps > 0 ? o.lapses / o.reps : 1);
  const ranked = [...eligible].sort((a, b) => {
    if (a.lapses !== b.lapses) return b.lapses - a.lapses;
    const ra = rateOf(a);
    const rb = rateOf(b);
    if (ra !== rb) return rb - ra;
    return a.label.localeCompare(b.label);
  });
  const leak = ranked[0];
  const rate = rateOf(leak);
  const firstTryPct = pct(1 - rate);

  // Severity rises with lapse count, capped. 3 lapses ⇒ ~0.5, 6+ ⇒ ~1.
  const severity = clamp01(leak.lapses / 6);

  return {
    area: 'opening',
    kind: 'opening',
    label: leak.label,
    title: `You keep leaving book in the ${leak.label}`,
    evidence:
      `${firstTryPct}% first-try over ${leak.reps} drills — ` +
      `missed ${leak.lapses} time${leak.lapses === 1 ? '' : 's'}`,
    severity,
    actionHref: `/openings?repertoire=${encodeURIComponent(leak.repertoireId)}`,
    accuracy: 1 - rate,
    sampleSize: leak.reps,
    estimatedEloUpside: Math.round(8 + severity * 30),
  };
}

/**
 * The endgame family the user fails most. Fires when a category has ≥
 * {@link ENDGAME_GAP_MIN_UNSOLVED} attempted-but-never-solved drills. Picks the
 * category with the most unsolved (tie-break by miss rate, then category).
 * Returns `null` when no family has a real gap.
 */
export function endgameGap(stats: EndgameCategoryStat[]): WeaknessDto | null {
  const eligible = stats.filter((s) => s.unsolved >= ENDGAME_GAP_MIN_UNSOLVED);
  if (eligible.length === 0) return null;

  const rateOf = (s: EndgameCategoryStat) =>
    s.attempted > 0 ? s.unsolved / s.attempted : 1;
  const ranked = [...eligible].sort((a, b) => {
    if (a.unsolved !== b.unsolved) return b.unsolved - a.unsolved;
    const ra = rateOf(a);
    const rb = rateOf(b);
    if (ra !== rb) return rb - ra;
    return a.category.localeCompare(b.category);
  });
  const gap = ranked[0];
  const name = humanize(gap.category);
  const solved = gap.attempted - gap.unsolved;

  // Severity rises with how many of the attempted drills remain unsolved.
  const severity = clamp01(rateOf(gap));

  return {
    area: 'endgame',
    kind: 'endgame',
    slug: gap.category,
    label: `${name} endgames`,
    title: `${name} endgames are leaking points`,
    evidence:
      `${solved}/${gap.attempted} ${name.toLowerCase()} drills solved — ` +
      `${gap.unsolved} still unbeaten`,
    severity,
    actionHref: `/endgames?category=${encodeURIComponent(gap.category)}`,
    accuracy: gap.attempted > 0 ? solved / gap.attempted : undefined,
    sampleSize: gap.attempted,
    estimatedEloUpside: Math.round(8 + severity * 25),
  };
}

/**
 * Time management — the MOST CONSERVATIVE detector. It fires on exactly one of
 * two clear signals (it never fires on thin data):
 *
 *   1. FAST BLUNDERS — the user has ≥ {@link TIME_FAST_MOVE_MIN_SAMPLE} fast
 *      moves (< {@link TIME_FAST_MOVE_MS}ms) AND blunders on them at a rate ≥
 *      {@link TIME_FAST_BLUNDER_RATE} AND that rate is meaningfully WORSE than
 *      their overall blunder baseline (fast moves are the problem, not just a
 *      generally blundery player). Without the baseline comparison a careful
 *      slow player and a reckless fast one look identical, so we require the
 *      fast rate to roughly double the baseline.
 *
 *   2. FLAG LOSSES — over ≥ {@link TIME_FLAG_MIN_GAMES} decisive games, the user
 *      loses on the clock at a rate ≥ {@link TIME_FLAG_LOSS_RATE} (chronic time
 *      trouble, not one unlucky flag).
 *
 * Below either sample floor it returns `null` — no signal beats a wrong signal
 * here, because a bogus time-management nudge is the easiest way to lose trust.
 */
export function timeManagement(agg: MoveTimeAgg): WeaknessDto | null {
  // --- Signal 2 (flag losses) — checked first; a hard, unambiguous outcome. ---
  if (agg.decisiveGames >= TIME_FLAG_MIN_GAMES) {
    const flagRate = agg.flagLosses / agg.decisiveGames;
    if (flagRate >= TIME_FLAG_LOSS_RATE && agg.flagLosses >= 2) {
      const severity = clamp01((flagRate - TIME_FLAG_LOSS_RATE) / (0.5 - TIME_FLAG_LOSS_RATE) + 0.4);
      return {
        area: 'time',
        kind: 'time',
        label: 'Time management',
        title: 'You are losing games on the clock',
        evidence: `${agg.flagLosses} of your last ${agg.decisiveGames} decisive games lost on time (${pct(flagRate)}%)`,
        severity,
        actionHref: '/play',
        sampleSize: agg.decisiveGames,
        estimatedEloUpside: Math.round(15 + severity * 35),
      };
    }
  }

  // --- Signal 1 (fast blunders) — requires the baseline comparison. ---
  if (
    agg.fastMoves >= TIME_FAST_MOVE_MIN_SAMPLE &&
    agg.totalClassifiedMoves >= TIME_FAST_MOVE_MIN_SAMPLE
  ) {
    const fastRate = agg.fastBlunders / agg.fastMoves;
    const baseRate =
      agg.totalClassifiedMoves > 0 ? agg.totalBlunders / agg.totalClassifiedMoves : 0;
    // Fire only when fast moves blunder often AND clearly worse than baseline
    // (≈ 2× the overall rate). A uniformly-blundery player isn't a TIME problem.
    if (fastRate >= TIME_FAST_BLUNDER_RATE && fastRate >= baseRate * 2) {
      const severity = clamp01((fastRate - TIME_FAST_BLUNDER_RATE) / (0.6 - TIME_FAST_BLUNDER_RATE) + 0.4);
      return {
        area: 'time',
        kind: 'time',
        label: 'Time management',
        title: 'You blunder when you move too fast',
        evidence:
          `${pct(fastRate)}% of your fast moves (<${TIME_FAST_MOVE_MS / 1000}s) were blunders — ` +
          `${pct(baseRate)}% overall. Slow down on critical moves`,
        severity,
        actionHref: '/play',
        sampleSize: agg.fastMoves,
        estimatedEloUpside: Math.round(12 + severity * 30),
      };
    }
  }

  return null;
}

/** Every detector, in declaration order (the service runs them all). */
export const ALL_DETECTORS = {
  tacticalThemeWeakness,
  recurringGameMistake,
  openingLeak,
  chessComOpeningWeakness,
  endgameGap,
  timeManagement,
} as const;
