export interface EcoEntry {
  code: string;
  name: string;
  moves: string;
}

export const ECO_OPENINGS: EcoEntry[] = [
  // A — Flank / English / Reti
  { code: 'A00', name: "Bird's Opening", moves: 'f4' },
  { code: 'A04', name: 'Reti Opening', moves: 'Nf3' },
  { code: 'A10', name: 'English Opening', moves: 'c4' },
  { code: 'A20', name: "English Opening, King's English Variation", moves: 'c4 e5' },
  { code: 'A25', name: 'English Opening, Closed Sicilian', moves: 'c4 e5 Nc3 Nc6' },
  { code: 'A40', name: "Horwitz Defense", moves: 'd4 e6' },
  { code: 'A45', name: 'Trompowsky Attack', moves: 'd4 Nf6 Bg5' },

  // B — Semi-open games (1.e4, no 1…e5)
  { code: 'B01', name: 'Scandinavian Defense', moves: 'e4 d5' },
  { code: 'B06', name: 'Pirc Defense', moves: 'e4 d6' },
  { code: 'B07', name: 'Pirc Defense, Classical Variation', moves: 'e4 d6 d4 Nf6 Nc3' },
  { code: 'B10', name: 'Caro-Kann Defense', moves: 'e4 c6' },
  { code: 'B12', name: 'Caro-Kann Defense, Advance Variation', moves: 'e4 c6 d4 d5 e5' },
  { code: 'B13', name: 'Caro-Kann Defense, Exchange Variation', moves: 'e4 c6 d4 d5 exd5 cxd5' },
  { code: 'B20', name: 'Sicilian Defense', moves: 'e4 c5' },
  { code: 'B23', name: 'Sicilian Defense, Closed Variation', moves: 'e4 c5 Nc3' },
  { code: 'B30', name: 'Sicilian Defense, Old Sicilian', moves: 'e4 c5 Nf3 Nc6' },
  { code: 'B40', name: 'Sicilian Defense, French Variation', moves: 'e4 c5 Nf3 e6' },
  {
    code: 'B45',
    name: 'Sicilian Defense, Taimanov Variation',
    moves: 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6',
  },
  { code: 'B50', name: 'Sicilian Defense, Modern Variations', moves: 'e4 c5 Nf3 d6' },
  {
    code: 'B57',
    name: 'Sicilian Defense, Classical Variation',
    moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6',
  },
  {
    code: 'B76',
    name: 'Sicilian Defense, Dragon Variation',
    moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6',
  },
  {
    code: 'B90',
    name: 'Sicilian Defense, Najdorf Variation',
    moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6',
  },

  // C — Open games (1.e4 e5)
  { code: 'C00', name: 'French Defense', moves: 'e4 e6' },
  { code: 'C02', name: 'French Defense, Advance Variation', moves: 'e4 e6 d4 d5 e5' },
  { code: 'C11', name: 'French Defense, Classical Variation', moves: 'e4 e6 d4 d5 Nc3 Nf6' },
  { code: 'C15', name: 'French Defense, Winawer Variation', moves: 'e4 e6 d4 d5 Nc3 Bb4' },
  { code: 'C20', name: "King's Pawn Game", moves: 'e4 e5' },
  { code: 'C30', name: "King's Gambit", moves: 'e4 e5 f4' },
  { code: 'C31', name: "King's Gambit Declined, Falkbeer Counter Gambit", moves: 'e4 e5 f4 d5' },
  { code: 'C33', name: "King's Gambit Accepted", moves: 'e4 e5 f4 exf4' },
  { code: 'C40', name: "King's Knight Opening", moves: 'e4 e5 Nf3' },
  { code: 'C41', name: 'Philidor Defense', moves: 'e4 e5 Nf3 d6' },
  { code: 'C42', name: 'Petrov Defense', moves: 'e4 e5 Nf3 Nf6' },
  { code: 'C44', name: 'Scotch Game', moves: 'e4 e5 Nf3 Nc6 d4' },
  {
    code: 'C45',
    name: 'Scotch Game, Schmidt Variation',
    moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4',
  },
  { code: 'C50', name: 'Italian Game', moves: 'e4 e5 Nf3 Nc6 Bc4' },
  { code: 'C55', name: 'Two Knights Defense', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6' },
  { code: 'C60', name: 'Ruy Lopez', moves: 'e4 e5 Nf3 Nc6 Bb5' },
  { code: 'C65', name: 'Ruy Lopez, Berlin Defense', moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6' },
  { code: 'C68', name: 'Ruy Lopez, Exchange Variation', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6' },
  { code: 'C70', name: 'Ruy Lopez, Morphy Defense', moves: 'e4 e5 Nf3 Nc6 Bb5 a6' },

  // D — Closed games / Queen's Gambit
  { code: 'D00', name: "Queen's Pawn Game", moves: 'd4 d5' },
  { code: 'D02', name: 'London System', moves: 'd4 d5 Nf3 Nf6 Bf4' },
  { code: 'D04', name: 'Colle System', moves: 'd4 d5 Nf3 Nf6 e3' },
  { code: 'D10', name: 'Slav Defense', moves: 'd4 d5 c4 c6' },
  { code: 'D20', name: "Queen's Gambit Accepted", moves: 'd4 d5 c4 dxc4' },
  { code: 'D30', name: "Queen's Gambit Declined", moves: 'd4 d5 c4 e6' },
  {
    code: 'D43',
    name: 'Semi-Slav Defense',
    moves: 'd4 d5 c4 c6 Nc3 Nf6 Nf3 e6',
  },

  // E — Indian defenses
  { code: 'E00', name: 'Catalan Opening', moves: 'd4 Nf6 c4 e6 g3' },
  { code: 'E15', name: "Queen's Indian Defense", moves: 'd4 Nf6 c4 e6 Nf3 b6' },
  { code: 'E20', name: 'Nimzo-Indian Defense', moves: 'd4 Nf6 c4 e6 Nc3 Bb4' },
  { code: 'E60', name: "King's Indian Defense", moves: 'd4 Nf6 c4 g6' },
  { code: 'E62', name: "King's Indian Defense, Fianchetto Variation", moves: 'd4 Nf6 c4 g6 Nc3 Bg7 Nf3' },
  { code: 'E70', name: "King's Indian Defense, Saemisch Variation", moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3' },
  { code: 'E90', name: "King's Indian Defense, Classical Variation", moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3' },
  { code: 'D90', name: 'Grunfeld Defense', moves: 'd4 Nf6 c4 g6 Nc3 d5' },
];
