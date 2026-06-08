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

export type ProfileDto = {
  username: string;
  avatarUrl: string | null;
  createdAt: string;
  ratings: RatingDto[];
  stats: StatsDto;
  recentGames: GameHistorySummaryDto[];
};

export type GameHistoryResponseDto = {
  games: GameHistorySummaryDto[];
  nextCursor: string | null;
};

export type UpdateMeDto = {
  username?: string;
  avatarUrl?: string | null;
};
