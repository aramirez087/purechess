import type { TimeControl } from '../time-control.js';

export interface JoinQueueDto {
  timeControl: TimeControl;
  ratingRange?: number;
}

export interface QueueStatusDto {
  inQueue: boolean;
  timeControl?: TimeControl;
  waitSeconds?: number;
  estimatedWaitSeconds?: number;
}
