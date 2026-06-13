/**
 * Shape of the public Lichess daily-puzzle response
 * (`GET https://lichess.org/api/puzzle/daily`). We proxy it verbatim, so the
 * type lives here in the module — the web app consumes our API, not Lichess,
 * and re-declares the matching shape on its side rather than importing from
 * `@purechess/shared` (this is not a cross-app DTO).
 */
export interface LichessPuzzlePlayer {
  name: string;
  color: string;
  rating?: number;
}

export interface LichessPuzzleData {
  game: {
    id: string;
    pgn: string;
    players: LichessPuzzlePlayer[];
  };
  puzzle: {
    id: string;
    initialPly: number;
    solution: string[];
    rating: number;
    plays: number;
    themes: string[];
  };
}
