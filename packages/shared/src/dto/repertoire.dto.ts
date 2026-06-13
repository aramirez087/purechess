/**
 * Opening-repertoire DTOs shared between web and api.
 *
 * A repertoire is the set of opening lines a user actually plays, stored as a
 * serialized move tree. The tree shape is the SAME `AnalysisNode` the /analyze
 * board uses (`apps/web/src/lib/board/analysis-tree.ts`) — this is the single
 * canonical serialization, mirrored here as a plain interface so the API can
 * type `treeJson` without importing web code. Do NOT invent a second format.
 *
 * Node-path convention (what S09 drills against): a path is `number[]`, each
 * element an index into the node's `children[]` at that depth; `[]` is the
 * root. A leaf line is addressed by the path from root to that leaf. The
 * mainline is every node's `children[0]`; later siblings are alternatives.
 */

/** PGN board annotation (arrow/circle) — mirrors `lib/board/annotations`. */
export interface RepertoireShapeDto {
  type: 'arrow' | 'circle';
  /** Arrows carry from/to; circles carry square. */
  from?: string;
  to?: string;
  square?: string;
  color?: 'green' | 'red' | 'yellow' | 'blue';
}

/**
 * One node in the serialized move tree. Position-after-move FEN, the SAN/UCI
 * that led here (both '' for the root), and the children that continue it.
 * Structurally identical to the web `AnalysisNode`.
 */
export interface RepertoireNodeDto {
  /** Position after the move (or the start position for the root). */
  fen: string;
  /** SAN that led to this node; '' for the root. */
  san: string;
  /** UCI that led to this node; '' for the root. */
  uci: string;
  children: RepertoireNodeDto[];
  /** PGN comment text. */
  comment?: string;
  /** Standard PGN NAG (1=!, 2=?, 3=!!, 4=??, 5=!?, 6=?!). */
  nag?: number;
  /** Board annotations attached to this position. */
  shapes?: RepertoireShapeDto[];
}

/** White or black repertoire — mirrors the `RepertoireColor` Postgres enum. */
export type RepertoireColorDto = 'white' | 'black';

/** Full repertoire with its serialized move tree. */
export interface RepertoireDto {
  id: string;
  name: string;
  color: RepertoireColorDto;
  /** Start position of the tree (the root node's FEN). */
  rootFen: string;
  /** The serialized `AnalysisNode` tree (root node). */
  tree: RepertoireNodeDto;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lightweight list entry — no tree payload. `lineCount` is the number of leaf
 * lines (distinct root→leaf paths); `nodeCount` the total move nodes.
 */
export interface RepertoireSummaryDto {
  id: string;
  name: string;
  color: RepertoireColorDto;
  rootFen: string;
  lineCount: number;
  nodeCount: number;
  /** ISO timestamp of the most recent drill (RepertoireReview), if any. */
  lastTrainedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Body for `POST /repertoire` — create from a pre-built tree. */
export interface CreateRepertoireDto {
  name: string;
  color: RepertoireColorDto;
  /** The serialized tree. Its root FEN is the repertoire's rootFen. */
  tree: RepertoireNodeDto;
}

/** Body for `PUT /repertoire/:id` — all fields optional (partial update). */
export interface UpdateRepertoireDto {
  name?: string;
  color?: RepertoireColorDto;
  tree?: RepertoireNodeDto;
}

/**
 * Body for `POST /repertoire/import`. Supply EITHER a pre-parsed `tree` (the
 * web app parses PGN client-side via the existing parser — preferred) OR a raw
 * `pgn` string for the server to parse. The server validates structure +
 * legality of a sampled set of nodes and enforces the node-count cap either
 * way.
 */
export interface ImportRepertoireDto {
  name: string;
  color: RepertoireColorDto;
  /** Pre-parsed tree (preferred — client parses PGN with the existing parser). */
  tree?: RepertoireNodeDto;
  /** Raw PGN, parsed server-side when no `tree` is given. */
  pgn?: string;
}
