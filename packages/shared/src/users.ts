export type RatingDto = {
  category: 'bullet' | 'blitz' | 'rapid';
  rating: number;
  gamesPlayed: number;
};

export type StatsDto = {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
};

export type GameHistorySummaryDto = {
  id: string;
  opponentUsername: string;
  playedAs: 'white' | 'black';
  result: 'win' | 'loss' | 'draw' | null;
  ratingDelta: number | null;
  category: 'bullet' | 'blitz' | 'rapid';
  timeControlSeconds: number;
  incrementSeconds: number;
  isRated: boolean;
  isVsComputer: boolean;
  endedAt: string | null;
};

export type RatingHistoryPoint = {
  ratingAfter: number;
  /** positive = likely win, negative = likely loss, 0 = draw */
  ratingDelta: number;
  /** for deep linking to /games/:id */
  gameId: string | null;
  /** ISO datetime from createdAt */
  playedAt: string;
  category: 'bullet' | 'blitz' | 'rapid';
};

export type ProfileDto = {
  username: string;
  avatarUrl: string | null;
  createdAt: string;
  ratings: RatingDto[];
  ratingHistory: RatingHistoryPoint[];
  stats: StatsDto;
  recentGames: GameHistorySummaryDto[];
};

export type GameHistoryResponseDto = {
  games: GameHistorySummaryDto[];
  nextCursor: string | null;
  /**
   * Total number of games matching the filters (ignores cursor/limit).
   * Optional so older API responses remain valid.
   */
  total?: number;
};

export type UpdateMeDto = {
  username?: string;
  avatarUrl?: string | null;
};
