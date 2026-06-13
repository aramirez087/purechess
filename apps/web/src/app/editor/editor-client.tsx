'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eraser, FlipVertical2, RotateCcw, Search, Swords } from 'lucide-react';
import type { Color, Square, PieceType } from '@purechess/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PILL_ACTIVE, PILL_BASE, PILL_INACTIVE } from '@/components/play/pill-styles';
import { EditorBoard } from '@/components/editor/editor-board';
import { PiecePalette, type PaletteSelection } from '@/components/editor/piece-palette';
import { PracticeFromFenDialog } from '@/components/play/practice-from-fen-dialog';
import {
  type EditorState,
  STARTING_EDITOR_STATE,
  clearBoard,
  editorStateToFen,
  fenToEditorState,
  placePiece,
  removeSquare,
} from '@/lib/board/editor-state';
import { cn } from '@/lib/utils';

type CastlingKey = 'wK' | 'wQ' | 'bK' | 'bQ';

const CASTLING_BUTTONS: { key: CastlingKey; glyph: string; label: string }[] = [
  { key: 'wK', glyph: '♔', label: 'White kingside' },
  { key: 'wQ', glyph: '♕', label: 'White queenside' },
  { key: 'bK', glyph: '♚', label: 'Black kingside' },
  { key: 'bQ', glyph: '♛', label: 'Black queenside' },
];

function hasPiece(state: EditorState, square: Square, type: PieceType, color: Color): boolean {
  const p = state.board.get(square);
  return p?.type === type && p?.color === color;
}

/** Castling is only meaningful when the matching king + rook sit on home squares. */
function castlingHomeOk(state: EditorState): Record<CastlingKey, boolean> {
  return {
    wK: hasPiece(state, 'e1', 'k', 'w') && hasPiece(state, 'h1', 'r', 'w'),
    wQ: hasPiece(state, 'e1', 'k', 'w') && hasPiece(state, 'a1', 'r', 'w'),
    bK: hasPiece(state, 'e8', 'k', 'b') && hasPiece(state, 'h8', 'r', 'b'),
    bQ: hasPiece(state, 'e8', 'k', 'b') && hasPiece(state, 'a8', 'r', 'b'),
  };
}

export function EditorClient() {
  const router = useRouter();
  const [editorState, setEditorState] = useState<EditorState>(STARTING_EDITOR_STATE);
  const [palettePiece, setPalettePiece] = useState<PaletteSelection | null>(null);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [fenText, setFenText] = useState(() => editorStateToFen(STARTING_EDITOR_STATE));
  const [fenValid, setFenValid] = useState(true);

  const fen = editorStateToFen(editorState);
  const homeOk = castlingHomeOk(editorState);

  /** Board/control edits flow through here so the FEN field always stays in sync. */
  function applyState(next: EditorState) {
    setEditorState(next);
    setFenText(editorStateToFen(next));
    setFenValid(true);
  }

  function handleFenInput(value: string) {
    setFenText(value);
    const parsed = fenToEditorState(value);
    if (parsed) {
      setEditorState(parsed);
      setFenValid(true);
    } else {
      setFenValid(false);
    }
  }

  function handleSquareClick(square: Square) {
    if (!palettePiece) return;
    applyState(
      palettePiece === 'trash'
        ? removeSquare(editorState, square)
        : placePiece(editorState, square, palettePiece),
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-6 animate-rise">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Setup</p>
        <h1 className="mt-1.5 font-display text-3xl tracking-[-0.01em] sm:text-4xl">Board editor</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Drag pieces or use the palette to set up any position, then analyze it or practice vs the
          computer.
        </p>
      </header>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Palette */}
        <div className="shrink-0">
          <PiecePalette active={palettePiece} onSelect={setPalettePiece} />
        </div>

        {/* Board */}
        <div className="w-full max-w-[min(70vh,560px)]">
          <EditorBoard
            state={editorState}
            onChange={applyState}
            flipped={flipped}
            onSquareClick={handleSquareClick}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setFlipped((f) => !f)}>
              <FlipVertical2 className="mr-1.5 h-4 w-4" />
              Flip
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyState(clearBoard(editorState))}>
              <Eraser className="mr-1.5 h-4 w-4" />
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyState(STARTING_EDITOR_STATE)}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex w-full flex-col gap-5 lg:max-w-xs">
          {/* FEN */}
          <div className="space-y-1.5">
            <Label
              htmlFor="editor-fen"
              className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
            >
              FEN
            </Label>
            <Input
              id="editor-fen"
              value={fenText}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => handleFenInput(e.target.value)}
              className={cn('font-mono text-[12px]', !fenValid && 'border-destructive')}
            />
            {!fenValid && (
              <p role="alert" className="text-xs text-destructive">
                Invalid FEN — board not updated.
              </p>
            )}
          </div>

          {/* Side to move */}
          <div className="space-y-2.5">
            <Label className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Side to move
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['w', 'b'] as Color[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={editorState.sideToMove === c}
                  onClick={() => applyState({ ...editorState, sideToMove: c })}
                  className={cn(
                    PILL_BASE,
                    'h-10 text-sm',
                    editorState.sideToMove === c ? PILL_ACTIVE : PILL_INACTIVE,
                  )}
                >
                  {c === 'w' ? 'White' : 'Black'}
                </button>
              ))}
            </div>
          </div>

          {/* Castling */}
          <div className="space-y-2.5">
            <Label className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Castling
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {CASTLING_BUTTONS.map(({ key, glyph, label }) => {
                const disabled = !homeOk[key];
                const on = editorState.castling[key];
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={label}
                    aria-pressed={on}
                    disabled={disabled}
                    onClick={() =>
                      applyState({
                        ...editorState,
                        castling: { ...editorState.castling, [key]: !on },
                      })
                    }
                    className={cn(
                      PILL_BASE,
                      'h-10 text-lg leading-none disabled:cursor-not-allowed disabled:opacity-40',
                      on && !disabled ? PILL_ACTIVE : PILL_INACTIVE,
                    )}
                  >
                    {glyph}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={() => router.push('/analyze?fen=' + encodeURIComponent(fen))}
              className="h-11 bg-foreground font-semibold text-background shadow-elevated hover:bg-foreground/90"
            >
              <Search className="mr-2 h-4 w-4" />
              Analyze position
            </Button>
            <Button variant="outline" onClick={() => setPracticeOpen(true)} className="h-11">
              <Swords className="mr-2 h-4 w-4" />
              Practice vs computer
            </Button>
          </div>
        </div>
      </div>

      <PracticeFromFenDialog
        fen={fen}
        open={practiceOpen}
        onClose={() => setPracticeOpen(false)}
      />
    </div>
  );
}
