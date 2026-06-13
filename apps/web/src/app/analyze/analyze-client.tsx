'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/layout/Logo';
import { AnalyzeBoard } from '@/app/analyze/analyze-board';
import { buildReviewFromFen, buildReviewFromPgn } from '@/services/game-review.service';
import type { AnalysisReview } from '@/types/game-review';

/**
 * Auto-detects pasted PGN vs FEN. A FEN's first field is the piece
 * placement — exactly seven rank separators; everything else is tried as
 * PGN first, with the other format as a fallback.
 */
function parseAnalysisInput(raw: string): AnalysisReview | null {
  const text = raw.trim();
  if (!text) return null;
  const firstToken = text.split(/\s+/)[0] ?? '';
  const looksLikeFen = (firstToken.match(/\//g) ?? []).length === 7;
  return looksLikeFen
    ? (buildReviewFromFen(text) ?? buildReviewFromPgn(text))
    : (buildReviewFromPgn(text) ?? buildReviewFromFen(text));
}

export function AnalyzeClient({ initialInput = '' }: { initialInput?: string }) {
  const [input, setInput] = useState(initialInput);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<AnalysisReview | null>(null);

  // Arriving from the board editor with ?fen=… — auto-load the position so the
  // user lands on the analysis board, not the paste form. Mount only.
  useEffect(() => {
    if (!initialInput) return;
    const parsed = parseAnalysisInput(initialInput);
    if (parsed) setReview(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The submit unmounts the focused button and mounts the review shell —
  // hand keyboard/SR focus to the shell so the swap is not a dead end.
  // (The reverse path is covered by the textarea's autoFocus.)
  useEffect(() => {
    if (review) document.getElementById('main-content')?.focus();
  }, [review]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseAnalysisInput(input);
    if (!parsed) {
      setError("Couldn't read that. Paste a complete PGN game or a FEN position.");
      return;
    }
    setError(null);
    setReview(parsed);
  }

  if (review) {
    // The bespoke dark analysis shell takes over the page; the input (and the
    // pasted text) stays in state so "New analysis" returns to it intact.
    return (
      <AnalyzeBoard
        game={review}
        exitAction={
          <button
            type="button"
            onClick={() => setReview(null)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-3 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:text-[#f1eee6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b] active:translate-y-px active:bg-[#0b0d0b]/60"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            New analysis
          </button>
        }
      />
    );
  }

  return (
    <main
      id="main-content"
      className="grain relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-10"
      style={{
        background:
          'radial-gradient(70% 50% at 50% -5%, hsl(var(--brass) / 0.14), transparent 62%), radial-gradient(120% 120% at 50% 120%, hsl(var(--shadow-rgb, 0 0 0) / 0.45), transparent 55%), hsl(var(--background))',
      }}
    >
      <div className="relative z-10 w-full max-w-[600px]">
        <div className="mb-7 flex flex-col items-center gap-4 text-center">
          <Link
            href="/"
            aria-label="PureChess home"
            className="rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo size="lg" tone="brass" />
          </Link>
          <div>
            <h1 className="font-display text-[clamp(1.9rem,5vw,2.4rem)] italic leading-tight tracking-[-0.01em] text-foreground">
              Read the position.
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Paste a game or a single position — Purechess tells PGN and FEN apart.
            </p>
          </div>
        </div>

        <Card className="relative overflow-hidden border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-brass/40 before:to-transparent">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              <div className="space-y-1.5">
                <Label
                  htmlFor="analysis-input"
                  className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Game record · PGN or FEN
                </Label>
                <textarea
                  id="analysis-input"
                  rows={7}
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={
                    '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 …\n\nr1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4'
                  }
                  className="flex w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-[13px] leading-relaxed shadow-[inset_0_1px_2px_hsl(var(--shadow-rgb)/0.25)] transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-muted-foreground/40 focus-visible:border-brass/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="animate-error-in rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:text-[hsl(0_72%_70%)]"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                // In-app primary stays bone — solid brass is reserved for the auth door (design.md).
                className="mt-1 h-11 w-full bg-foreground font-semibold text-background shadow-elevated transition-all duration-150 hover:bg-foreground/90 active:translate-y-px"
              >
                Analyze
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nothing leaves your browser — Stockfish runs locally.
        </p>
      </div>
    </main>
  );
}
