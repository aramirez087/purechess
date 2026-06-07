// Pure TS mirror of Prisma enums. Values must match schema.prisma exactly.
// If Prisma enums change, update here too and keep in sync.

export enum DbGameResult {
  white_wins = 'white_wins',
  black_wins = 'black_wins',
  draw = 'draw',
}

export enum DbGameResultReason {
  checkmate = 'checkmate',
  resignation = 'resignation',
  timeout = 'timeout',
  stalemate = 'stalemate',
  insufficient_material = 'insufficient_material',
  threefold_repetition = 'threefold_repetition',
  fifty_move_rule = 'fifty_move_rule',
  draw_agreement = 'draw_agreement',
  abandonment = 'abandonment',
}

export enum DbGameStatus {
  pending = 'pending',
  active = 'active',
  completed = 'completed',
  aborted = 'aborted',
  invite_pending = 'invite_pending',
}

export enum DbTimeControlCategory {
  bullet = 'bullet',
  blitz = 'blitz',
  rapid = 'rapid',
}

export enum DbReportStatus {
  open = 'open',
  reviewed = 'reviewed',
  dismissed = 'dismissed',
}

export enum DbOAuthProvider {
  google = 'google',
  apple = 'apple',
}

export enum DbFairPlaySignalType {
  low_variance_move_time = 'low_variance_move_time',
  suspicious_accuracy = 'suspicious_accuracy',
  abnormal_streak = 'abnormal_streak',
  multi_account_ip = 'multi_account_ip',
  multi_account_fingerprint = 'multi_account_fingerprint',
}
