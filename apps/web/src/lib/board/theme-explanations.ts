/**
 * Curated, hand-written explanations for the common high-frequency tactical
 * themes. STATIC content — NO generation, no LLM. The point is to teach the
 * *pattern* (so the user recognizes it next time), not to narrate the specific
 * line; the move-by-move "why it works" comes from replaying the solution / the
 * motif arrow on the board, not from here.
 *
 * Slugs match the lichess puzzle-theme vocabulary that seeds our `Puzzle.themes`
 * (the same keys `themeCommonness` in the API insights engine uses). A theme we
 * have no entry for degrades gracefully via {@link explainTheme} (humanized name,
 * no copy) — callers should always go through that helper, never index the map
 * directly.
 */

export interface ThemeExplanation {
  /** Human-readable theme name, e.g. "Fork". */
  name: string;
  /** One sentence: what the motif IS. */
  oneLiner: string;
  /** One sentence: the board cue that should make you look for it. */
  whatToLookFor: string;
}

/**
 * The curated map. Keyed by lichess theme slug. Keep entries short, plain, and
 * instructional — a beginner should understand each in one read.
 */
export const THEME_EXPLANATIONS: Record<string, ThemeExplanation> = {
  fork: {
    name: 'Fork',
    oneLiner: 'One piece attacks two or more enemy targets at once, so the opponent can only save one.',
    whatToLookFor: 'A knight, pawn, or queen that can hit two undefended pieces — or a piece and the king — in a single move.',
  },
  pin: {
    name: 'Pin',
    oneLiner: 'A piece cannot move because doing so would expose a more valuable piece (or the king) behind it.',
    whatToLookFor: 'An enemy piece on the same line as its king or queen, with your bishop, rook, or queen aiming down that line.',
  },
  skewer: {
    name: 'Skewer',
    oneLiner: 'A pin in reverse: the valuable piece is in front and must move, leaving the piece behind it to be captured.',
    whatToLookFor: 'A king or queen you can attack along a line, with a weaker piece lined up directly behind it.',
  },
  discoveredAttack: {
    name: 'Discovered attack',
    oneLiner: 'Moving one piece uncovers an attack from a piece behind it, hitting two things at once.',
    whatToLookFor: 'One of your pieces blocking your own bishop, rook, or queen — move it and the line opens onto a target.',
  },
  discoveredCheck: {
    name: 'Discovered check',
    oneLiner: 'A discovered attack where the unveiled piece gives check, so the moving piece can grab material with tempo.',
    whatToLookFor: 'A piece you can move out of the way to deliver check from the piece behind it — while the mover captures or threatens.',
  },
  doubleCheck: {
    name: 'Double check',
    oneLiner: 'Two pieces give check at once, so the king is forced to move — nothing can block or capture both.',
    whatToLookFor: 'A discovered check where the moving piece ALSO checks; the king has no choice but to step away.',
  },
  backRankMate: {
    name: 'Back-rank mate',
    oneLiner: 'A rook or queen mates a king trapped on its back rank by its own unmoved pawns.',
    whatToLookFor: "An enemy king boxed in by the pawns in front of it, with no escape square and an open file or rank to your heavy piece.",
  },
  smotheredMate: {
    name: 'Smothered mate',
    oneLiner: 'A knight delivers mate to a king completely hemmed in by its own pieces.',
    whatToLookFor: 'An enemy king in the corner surrounded by its own pieces — a knight check it cannot escape or capture is mate.',
  },
  deflection: {
    name: 'Deflection',
    oneLiner: 'Force an enemy piece away from a square or duty it was guarding, then exploit what it no longer defends.',
    whatToLookFor: 'A single defender doing an important job — a check, capture, or threat that drags it off that job.',
  },
  decoy: {
    name: 'Decoy',
    oneLiner: 'Lure an enemy piece (often the king) onto a bad square where a tactic hits it.',
    whatToLookFor: 'A sacrifice that pulls a piece onto a fork, pin, or mating square it would never choose to stand on.',
  },
  attraction: {
    name: 'Attraction',
    oneLiner: 'Sacrifice to draw the enemy king or piece onto a square where a follow-up tactic wins.',
    whatToLookFor: 'A check or capture that forces the king onto a square that then walks into a fork or a mate.',
  },
  removingTheDefender: {
    name: 'Removing the defender',
    oneLiner: 'Capture or trade off the piece that was holding the defense together, then take what it guarded.',
    whatToLookFor: 'A target that is only defended once — eliminate that single defender and the target falls.',
  },
  capturingDefender: {
    name: 'Capturing the defender',
    oneLiner: 'Take the piece that defends a key square or unit, collapsing the defense.',
    whatToLookFor: 'A lone defender of a hanging piece or a mating square — capture it and the rest follows.',
  },
  hangingPiece: {
    name: 'Hanging piece',
    oneLiner: 'An enemy piece is left undefended and can simply be taken for free.',
    whatToLookFor: 'A piece with no defender — count attackers and defenders on it before assuming it is protected.',
  },
  trappedPiece: {
    name: 'Trapped piece',
    oneLiner: 'An enemy piece has no safe square to retreat to and can be won.',
    whatToLookFor: 'A piece deep in your territory or on the rim — cut off its escape squares and round it up.',
  },
  zwischenzug: {
    name: 'Zwischenzug (in-between move)',
    oneLiner: 'Insert a forcing move BEFORE the expected recapture, gaining time or material.',
    whatToLookFor: "A check or bigger threat you can throw in first — don't recapture automatically.",
  },
  intermezzo: {
    name: 'In-between move',
    oneLiner: 'Insert a forcing move before the natural reply, changing the outcome in your favor.',
    whatToLookFor: 'A check or larger threat available right now that the opponent must answer before they get their move in.',
  },
  sacrifice: {
    name: 'Sacrifice',
    oneLiner: 'Give up material to open lines, expose the king, or force a winning sequence.',
    whatToLookFor: "A forcing capture or check the opponent must answer, where the follow-up wins back more than you gave.",
  },
  clearance: {
    name: 'Clearance',
    oneLiner: 'Vacate a square or line — often by sacrifice — so another piece can use it decisively.',
    whatToLookFor: 'Your own piece in the way of a winning move; clear it, even at a cost, to let the key piece through.',
  },
  interference: {
    name: 'Interference',
    oneLiner: "Block the line between an enemy piece and what it defends, cutting the defense.",
    whatToLookFor: 'A defender guarding along a line — plant a piece between them to sever the connection.',
  },
  promotion: {
    name: 'Promotion',
    oneLiner: 'Push a pawn to the last rank to make a new queen (or piece) and win.',
    whatToLookFor: 'A passed pawn near promotion — clear its path or use a tactic so it cannot be stopped.',
  },
  underpromotion: {
    name: 'Underpromotion',
    oneLiner: 'Promote to a knight, rook, or bishop instead of a queen — when a queen would stalemate or miss a fork.',
    whatToLookFor: 'A promotion where a queen draws or loses; a knight that checks-and-forks, or a rook that avoids stalemate, wins.',
  },
  enPassant: {
    name: 'En passant',
    oneLiner: 'Capture an enemy pawn that just advanced two squares, as if it had moved only one.',
    whatToLookFor: "An enemy pawn that just played its two-square move beside your pawn — the capture is only legal right now.",
  },
  zugzwang: {
    name: 'Zugzwang',
    oneLiner: 'The opponent would be fine to pass, but any move they make worsens their position.',
    whatToLookFor: 'A position where the opponent is out of useful moves — every legal move concedes material or the game.',
  },
  defensiveMove: {
    name: 'Defensive move',
    oneLiner: 'The only move that holds the position — a precise defense, not a winning blow.',
    whatToLookFor: 'A threat against you that has exactly one answer; find the move that parries it without losing.',
  },
  quietMove: {
    name: 'Quiet move',
    oneLiner: 'A non-checking, non-capturing move that quietly sets up an unstoppable threat.',
    whatToLookFor: "An overwhelming threat you can prepare with a calm move — not every winning move is a check or capture.",
  },
  mateIn1: {
    name: 'Mate in 1',
    oneLiner: 'A single move delivers checkmate.',
    whatToLookFor: "A check the king cannot escape, block, or capture — scan every check before anything else.",
  },
  mateIn2: {
    name: 'Mate in 2',
    oneLiner: 'A forcing first move leads to checkmate on the next.',
    whatToLookFor: 'A check or threat that leaves the opponent only forced replies, all running into mate.',
  },
  mateIn3: {
    name: 'Mate in 3',
    oneLiner: 'A short forced sequence ends in checkmate, with every enemy reply covered.',
    whatToLookFor: 'A forcing line of checks and captures that strips the king of escape squares move by move.',
  },
  mate: {
    name: 'Checkmate',
    oneLiner: 'A forced sequence that ends in checkmate.',
    whatToLookFor: 'Forcing moves — checks, captures, threats — that leave the king no legal escape at the end.',
  },
};

/**
 * Look up a theme explanation, falling back gracefully when the slug isn't in
 * the curated map: returns a {@link ThemeExplanation} with a humanized name and
 * empty copy so the UI can always render *something* (a label) without copy.
 *
 * `null`/empty/whitespace slugs return null so the caller can skip them.
 */
export function explainTheme(slug: string | null | undefined): ThemeExplanation | null {
  if (!slug || !slug.trim()) return null;
  const key = slug.trim();
  const found = THEME_EXPLANATIONS[key];
  if (found) return found;
  // Graceful degradation: humanized label, no instructional copy.
  return { name: humanizeThemeSlug(key), oneLiner: '', whatToLookFor: '' };
}

/**
 * Resolve a list of theme slugs to their explanations, in order, dropping
 * blanks and de-duplicating by name. Capped at `limit` (default 2) so the
 * post-solve panel never lists a puzzle's entire theme tag soup.
 */
export function explainThemes(
  slugs: readonly string[] | null | undefined,
  limit = 2,
): ThemeExplanation[] {
  if (!slugs) return [];
  const out: ThemeExplanation[] = [];
  const seen = new Set<string>();
  for (const slug of slugs) {
    const ex = explainTheme(slug);
    if (!ex || seen.has(ex.name)) continue;
    seen.add(ex.name);
    out.push(ex);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * camelCase / kebab / mateInN slug → Title-case label. Local copy (the board lib
 * must not import the puzzle-components `humanizeTheme`, which lives in the
 * component tree); matches its output for the slugs we share.
 */
function humanizeThemeSlug(slug: string): string {
  const spaced = slug
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
