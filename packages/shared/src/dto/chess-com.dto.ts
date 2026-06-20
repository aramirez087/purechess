/**
 * Chess.com integration DTOs — link a public username, fetch games server-side,
 * analyze openings client-side (Stockfish), persist mistakes for insights.
 */

/** Linked chess.com account snapshot. */
export interface ChessComLinkDto {
  /** Lowercase chess.com username, or null when unlinked. */
  username: string | null;
  /** ISO timestamp of the last successful sync, if any. */
  lastSyncedAt?: string | null;
  /** Games scanned in the last sync. */
  gamesScanned?: number;
  /** Opening mistakes stored after the last sync. */
  mistakeCount?: number;
}

/** Body for `PUT /chess-com/link`. */
export interface SetChessComLinkDto {
  /** Public chess.com username to link (validated against the chess.com API). */
  username: string;
}

/** One game returned from the chess.com archives (PGN included). */
export interface ChessComGameDto {
  /** Stable id — the chess.com game URL. */
  id: string;
  url: string;
  pgn: string;
  endTime: number;
  timeControl: string;
  white: { username: string; rating: number };
  black: { username: string; rating: number };
  /** Which side the linked user played, if they were in this game. */
  userColor?: 'white' | 'black';
}

/** Response for `GET /chess-com/games`. */
export interface ChessComGamesDto {
  username: string;
  games: ChessComGameDto[];
  /** Months fetched from the archives. */
  monthsFetched: number;
}

/** One opening-phase mistake detected client-side before persistence. */
export interface ChessComOpeningMistakeCandidateDto {
  /** chess.com game URL — dedupe key with ply. */
  gameId: string;
  gameUrl: string;
  ply: number;
  fen: string;
  playedUci: string;
  playedSan: string;
  bestUci: string;
  bestSan?: string;
  cpLoss: number;
  /** Human opening label from PGN tags or move sequence. */
  openingLabel: string;
  /** ISO end time of the source game. */
  playedAt?: string;
}

/** Body for `POST /chess-com/opening-mistakes`. */
export interface SaveChessComMistakesDto {
  mistakes: ChessComOpeningMistakeCandidateDto[];
}

/** Persisted opening mistake (served to the openings hub + insights). */
export interface ChessComOpeningMistakeDto {
  gameId: string;
  gameUrl: string;
  ply: number;
  fen: string;
  playedUci: string;
  playedSan: string;
  bestUci: string;
  bestSan?: string;
  cpLoss: number;
  openingLabel: string;
  playedAt?: string;
  reviewed: boolean;
  createdAt: string;
}

/** `GET /chess-com/opening-mistakes` response. */
export interface ChessComOpeningMistakesDto {
  mistakes: ChessComOpeningMistakeDto[];
  /** Clustered summary for the UI — mistakes grouped by opening label. */
  clusters: ChessComOpeningClusterDto[];
}

/** Aggregate for one opening motif across multiple games. */
export interface ChessComOpeningClusterDto {
  openingLabel: string;
  count: number;
  /** Most recent mistake in this cluster. */
  latestPlayedAt?: string;
  avgCpLoss: number;
}