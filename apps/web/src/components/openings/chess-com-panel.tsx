'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Unlink,
} from 'lucide-react';
import type { ChessComOpeningMistakeDto } from '@purechess/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  clearChessComLink,
  fetchChessComLink,
  fetchChessComMistakes,
  setChessComLink,
} from '@/lib/api/chess-com';
import { useChessComSync } from '@/hooks/use-chess-com-sync';
import {
  displayOpeningLabel,
  openingLabelsMatch,
} from '@/lib/chess-com/opening-label';
import { openingLabHref } from '@/lib/openings/opening-deep-link';
import { cn } from '@/lib/utils';

/**
 * Link a chess.com username, sync recent games, and surface opening mistakes
 * mined from the user's real games (Aimchess-style Opening Improver).
 */
export function ChessComPanel({ highlightLabel }: { highlightLabel?: string | null }) {
  const queryClient = useQueryClient();
  const [usernameInput, setUsernameInput] = useState('');
  const { state: syncState, sync } = useChessComSync();

  const link = useQuery({
    queryKey: ['chess-com-link'],
    queryFn: fetchChessComLink,
  });

  const mistakes = useQuery({
    queryKey: ['chess-com-mistakes'],
    queryFn: fetchChessComMistakes,
    enabled: !!link.data?.username,
  });

  const linkMut = useMutation({
    mutationFn: setChessComLink,
    onSuccess: (data) => {
      queryClient.setQueryData(['chess-com-link'], data);
      queryClient.invalidateQueries({ queryKey: ['chess-com-mistakes'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });

  const unlinkMut = useMutation({
    mutationFn: clearChessComLink,
    onSuccess: (data) => {
      queryClient.setQueryData(['chess-com-link'], data);
      queryClient.setQueryData(['chess-com-mistakes'], { mistakes: [], clusters: [] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    const username = usernameInput.trim();
    if (!username) return;
    await linkMut.mutateAsync({ username });
    setUsernameInput('');
  }

  async function handleSync() {
    await sync();
    queryClient.invalidateQueries({ queryKey: ['chess-com-link'] });
    queryClient.invalidateQueries({ queryKey: ['chess-com-mistakes'] });
    queryClient.invalidateQueries({ queryKey: ['insights'] });
  }

  const linked = link.data?.username;
  const unreviewed = (mistakes.data?.mistakes ?? []).filter((m) => !m.reviewed);
  const filteredMistakes = highlightLabel
    ? unreviewed.filter((m) => openingLabelsMatch(m.openingLabel, highlightLabel))
    : unreviewed;
  const visibleMistakes = (filteredMistakes.length > 0 ? filteredMistakes : unreviewed).slice(
    0,
    5,
  );
  const highlightName = highlightLabel ? displayOpeningLabel(highlightLabel) : null;

  return (
    <section
      data-testid="chess-com-panel"
      className="flex flex-col gap-4 rounded-[12px] border border-border/70 bg-surface/55 p-5 shadow-inner-hairline"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            chess.com import
          </span>
          <h2 className="font-display text-xl italic text-foreground">
            Learn from your real games
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Link your chess.com username — we fetch recent games and run Stockfish on the opening
            phase (first ~11 moves). Each row is a real position where your move lost significant
            eval; use <span className="font-medium text-foreground">Study position</span> to explore
            the correction, or browse main lines in Opening Lab.
          </p>
        </div>
        {linked ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 font-medium text-brass-text">
              @{linked}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => unlinkMut.mutate()}
              disabled={unlinkMut.isPending}
              aria-label="Unlink chess.com account"
            >
              <Unlink className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>

      {!linked ? (
        <form onSubmit={handleLink} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Link2
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="chess.com username"
              className="pl-9"
              autoComplete="username"
              data-testid="chess-com-username-input"
            />
          </div>
          <Button type="submit" disabled={linkMut.isPending || !usernameInput.trim()}>
            {linkMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              'Link account'
            )}
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleSync}
            disabled={syncState.running}
            data-testid="chess-com-sync"
          >
            {syncState.running ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            {syncState.running ? 'Analyzing openings…' : 'Sync recent games'}
          </Button>
          {link.data?.lastSyncedAt ? (
            <span className="text-xs text-muted-foreground">
              Last sync {formatRelative(link.data.lastSyncedAt)}
              {link.data.gamesScanned != null ? ` · ${link.data.gamesScanned} games` : ''}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not synced yet</span>
          )}
        </div>
      )}

      {syncState.running ? (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Game {syncState.gamesScanned} · {syncState.mistakesFound} mistake
              {syncState.mistakesFound === 1 ? '' : 's'} found
            </span>
            <span className="tabular-nums">{Math.round(syncState.progress * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border/80">
            <div
              className="h-full rounded-full bg-brass transition-[width] duration-300"
              style={{ width: `${Math.round(syncState.progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Stockfish runs in your browser — first sync may take a few minutes.
          </p>
        </div>
      ) : null}

      {syncState.error ? (
        <p role="alert" className="text-sm text-destructive">
          {syncState.error}
        </p>
      ) : null}

      {syncState.notice && !syncState.running ? (
        <p className="text-sm text-muted-foreground">{syncState.notice}</p>
      ) : null}

      {linked && visibleMistakes.length > 0 ? (
        <div id="chess-com-mistakes" className="space-y-2 scroll-mt-24">
          {highlightName ? (
            <div className="rounded-[10px] border border-brass/40 bg-brass-soft/12 px-3 py-2.5">
              <p className="text-sm text-foreground">
                <span className="font-medium">Your {highlightName} mistakes</span>
                <span className="text-muted-foreground">
                  {' '}
                  — from synced chess.com games. Pick a row to study the position where you went
                  wrong.
                </span>
              </p>
            </div>
          ) : null}
          <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Opening mistakes to fix
          </h3>
          <ul className="space-y-2">
            {visibleMistakes.map((m) => (
              <MistakeRow
                key={`${m.gameId}-${m.ply}`}
                mistake={m}
                highlighted={
                  !!highlightLabel && openingLabelsMatch(m.openingLabel, highlightLabel)
                }
              />
            ))}
          </ul>
          {(filteredMistakes.length > 5 || (!highlightLabel && unreviewed.length > 5)) ? (
            <p className="text-xs text-muted-foreground">
              +
              {highlightLabel
                ? filteredMistakes.length - 5
                : unreviewed.length - 5}{' '}
              more stored from past syncs
            </p>
          ) : null}
        </div>
      ) : linked && !syncState.running && mistakes.isFetched ? (
        <p className="text-sm text-muted-foreground">
          No opening mistakes found yet — sync your games or play more rated games on chess.com.
        </p>
      ) : null}
    </section>
  );
}

function MistakeRow({
  mistake,
  highlighted = false,
}: {
  mistake: ChessComOpeningMistakeDto;
  highlighted?: boolean;
}) {
  const analyzeHref = `/analyze?fen=${encodeURIComponent(mistake.fen)}`;
  const openingName = displayOpeningLabel(mistake.openingLabel);
  const labHref = openingLabHref(openingName, mistake.fen);

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-[10px] border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
        highlighted
          ? 'border-brass/50 bg-brass-soft/15'
          : 'border-border bg-background/40',
      )}
    >
      <div className="min-w-0">
        <p className="font-medium text-foreground">{openingName}</p>
        <p className="text-sm text-muted-foreground">
          You played <span className="font-mono text-foreground">{mistake.playedSan}</span>
          {mistake.bestSan ? (
            <>
              {' '}
              — book says{' '}
              <span className="font-mono text-brass-text">{mistake.bestSan}</span>
            </>
          ) : null}
          <span className="text-muted-foreground"> ({mistake.cpLoss}cp)</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={analyzeHref}>
            Study position
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={labHref}>Browse in Lab</Link>
        </Button>
        <a
          href={mistake.gameUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground',
            'hover:bg-raised hover:text-foreground',
          )}
          aria-label="View game on chess.com"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

function formatRelative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}