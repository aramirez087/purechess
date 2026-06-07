import type { RatingRecord } from '../rating.js';

export interface UserProfileDto {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  ratings: RatingRecord[];
  gamesPlayed: number;
  memberSince: string;
}

export interface UpdateProfileDto {
  username?: string;
  bio?: string;
  country?: string;
  avatarUrl?: string;
}
