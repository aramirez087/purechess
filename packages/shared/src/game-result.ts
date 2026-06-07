export enum GameResult {
  WhiteWins = 'white_wins',
  BlackWins = 'black_wins',
  Draw = 'draw',
}

export enum GameTermination {
  Checkmate = 'checkmate',
  Resignation = 'resignation',
  Timeout = 'timeout',
  Stalemate = 'stalemate',
  InsufficientMaterial = 'insufficient_material',
  ThreefoldRepetition = 'threefold_repetition',
  FiftyMoveRule = 'fifty_move_rule',
  DrawAgreement = 'draw_agreement',
  Abandonment = 'abandonment',
}
