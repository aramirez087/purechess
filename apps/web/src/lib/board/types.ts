import type { Square, Move, MoveIntent, PieceType } from '@purechess/shared';
import type { BoardShape } from './annotations';

export type Orientation = 'white' | 'black';

export interface HighlightSet {
  selected?: Square;
  legalMoves: Square[];
  legalCaptures: Square[];
  lastMoveFrom?: Square;
  lastMoveTo?: Square;
  checkSquare?: Square;
  premoveTo?: Square;
  premoveFrom?: Square;
}

export interface DragState {
  active: boolean;
  from: Square | null;
  x: number;
  y: number;
  pointerId: number | null;
}

export interface BoardSettings {
  sound: boolean;
  coordinates: boolean;
  animationMs: number;
}

export interface ChessboardProps {
  position: string;
  orientation?: Orientation;
  legalMoves?: Move[];
  onMove?: (move: MoveIntent) => void;
  lastMove?: { from: Square; to: Square };
  checkSquare?: Square;
  className?: string;
  readOnly?: boolean;
  /**
   * Analysis boards: input follows the side to move instead of `orientation`,
   * so both colors are playable and premoves never engage.
   */
  freePlay?: boolean;
  /** Externally driven annotations (engine arrows) — never cleared by input. */
  autoShapes?: BoardShape[];
  /** Observe user-drawn shapes (drawing stays uncontrolled). */
  onShapesChange?: (shapes: BoardShape[]) => void;
}

export interface PromotionState {
  active: boolean;
  from: Square | null;
  to: Square | null;
}

export type SquareHighlight =
  | 'selected'
  | 'legal-move'
  | 'legal-capture'
  | 'last-move-from'
  | 'last-move-to'
  | 'in-check'
  | 'premove-from'
  | 'premove-to';

export type SoundType =
  | 'move'
  | 'capture'
  | 'castle'
  | 'promote'
  | 'check'
  | 'mate'
  | 'game-start'
  | 'tick';

export interface Premove {
  from: Square;
  to: Square;
  promotion?: PieceType;
}
