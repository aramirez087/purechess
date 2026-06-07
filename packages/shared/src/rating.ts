export enum RatingCategory {
  Bullet = 'bullet',
  Blitz = 'blitz',
  Rapid = 'rapid',
  Classical = 'classical',
}

export interface RatingRecord {
  category: RatingCategory;
  rating: number;
  ratingDeviation: number;
  volatility: number;
  gamesPlayed: number;
}
