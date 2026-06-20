'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, FlaskConical, Plus, Target } from 'lucide-react';
import type { RepertoireDto, RepertoireSummaryDto } from '@purechess/shared';
import {
  deleteRepertoire,
  fetchDrillLines,
  getRepertoire,
  listRepertoires,
} from '@/lib/api/repertoire';
import { Button } from '@/components/ui/button';
import { RepertoireImport } from '@/components/openings/repertoire-import';
import { RepertoireView } from '@/components/openings/repertoire-view';
import { OpeningDrill } from '@/components/openings/opening-drill';
import { cn } from '@/lib/utils';

type View =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'read'; id: string }
  | { kind: 'drill'; id: string; name: string };

/** Relative "trained" label. */
function lastTrainedLabel(iso?: string): string {
  if (!iso) return 'Not trained yet';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Trained today';
  if (days === 1) return 'Trained yesterday';
  if (days < 30) return `Trained ${days}d ago`;
  return `Trained ${Math.floor(days / 30)}mo ago`;
}

function ColorChip({ color }: { color: 'white' | 'black' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
        color === 'white'
          ? 'border-border bg-foreground/5 text-foreground'
          : 'border-border bg-background text-muted-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-2 w-2 rounded-full ring-1 ring-border',
          color === 'white' ? 'bg-[#f0ede5]' : 'bg-[#1a1e19]',
        )}
      />
      {color}
    </span>
  );
}

function RepertoireRow({
  rep,
  onOpen,
  onDrill,
}: {
  rep: RepertoireSummaryDto;
  onOpen: () => void;
  onDrill: () => void;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-border bg-surface/60 px-4 py-3.5 transition-colors hover:border-brass/50">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50 rounded-md"
      >
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{rep.name}</span>
          <ColorChip color={rep.color} />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {rep.lineCount} line{rep.lineCount === 1 ? '' : 's'} · {rep.nodeCount} move
          {rep.nodeCount === 1 ? '' : 's'} · {lastTrainedLabel(rep.lastTrainedAt)}
        </p>
      </button>
      <Button
        size="sm"
        variant="outline"
        onClick={onDrill}
        disabled={rep.lineCount === 0}
        className="shrink-0"
      >
        <Target className="h-4 w-4" aria-hidden="true" />
        Drill
      </Button>
    </div>
  );
}

/**
 * The Openings surface: list the user's repertoires, create/import a new one,
 * and read a stored one (rendered with the existing analysis tree components).
 * Server-authoritative — the client persists trees via the `/repertoire` API
 * and reads back summaries (line/move counts, last-trained).
 */
export function OpeningsClient({ signedOut }: { signedOut: boolean }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>({ kind: 'list' });

  const list = useQuery({
    queryKey: ['repertoires'],
    queryFn: listRepertoires,
    enabled: !signedOut,
  });

  const detail = useQuery({
    queryKey: ['repertoire', view.kind === 'read' ? view.id : null],
    queryFn: () => getRepertoire((view as { kind: 'read'; id: string }).id),
    enabled: view.kind === 'read',
  });

  const drillSession = useQuery({
    queryKey: ['repertoire-drill', view.kind === 'drill' ? view.id : null],
    queryFn: () => fetchDrillLines((view as { kind: 'drill'; id: string }).id),
    enabled: view.kind === 'drill',
    // A fresh session every time the user opens the drill (no stale due set).
    staleTime: 0,
    gcTime: 0,
  });

  const del = useMutation({
    mutationFn: deleteRepertoire,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repertoires'] });
      setView({ kind: 'list' });
    },
  });

  function handleSaved(created: RepertoireDto) {
    queryClient.invalidateQueries({ queryKey: ['repertoires'] });
    setView({ kind: 'read', id: created.id });
  }

  if (signedOut) {
    return (
      <div className="rounded-[12px] border border-border bg-surface/60 p-8 text-center">
        <BookOpen className="mx-auto mb-3 h-7 w-7 text-brass" aria-hidden="true" />
        <h2 className="font-display text-2xl italic text-foreground">Your opening repertoire</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Sign in to build and drill the openings you actually play — imported from PGN or the
          opening explorer, stored as a move tree.
        </p>
        <Button asChild className="mt-5">
          <Link href="/login?return=/openings">Sign in to start</Link>
        </Button>
      </div>
    );
  }

  if (view.kind === 'new') {
    return (
      <div className="mx-auto max-w-3xl">
        <RepertoireImport onSaved={handleSaved} onCancel={() => setView({ kind: 'list' })} />
      </div>
    );
  }

  if (view.kind === 'read') {
    if (detail.isLoading || !detail.data) {
      return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;
    }
    return (
      <div className="mx-auto max-w-4xl">
        <RepertoireView
          repertoire={detail.data}
          onBack={() => setView({ kind: 'list' })}
          onDelete={(id) => del.mutate(id)}
          deleting={del.isPending}
        />
      </div>
    );
  }

  if (view.kind === 'drill') {
    if (drillSession.isLoading || !drillSession.data) {
      return <p className="py-10 text-center text-sm text-muted-foreground">Loading drill…</p>;
    }
    return (
      <div className="mx-auto max-w-4xl">
        <OpeningDrill
          repertoireId={view.id}
          repertoireName={view.name}
          drill={drillSession.data}
          onBack={() => {
            queryClient.invalidateQueries({ queryKey: ['repertoires'] });
            setView({ kind: 'list' });
          }}
          onRestart={() => drillSession.refetch()}
        />
      </div>
    );
  }

  // view.kind === 'list'
  const repertoires = list.data ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl italic text-foreground">Repertoire</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The lines you play, stored as a tree — import, drill, and review.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/openings/lab">
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
              Opening Lab
            </Link>
          </Button>
          <Button onClick={() => setView({ kind: 'new' })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New repertoire
          </Button>
        </div>
      </div>

      {list.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : repertoires.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-border bg-surface/40 p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium text-foreground">No repertoires yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Import a PGN or build a line from the opening explorer to get started.
          </p>
          <Button className="mt-5" onClick={() => setView({ kind: 'new' })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New repertoire
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {repertoires.map((rep) => (
            <RepertoireRow
              key={rep.id}
              rep={rep}
              onOpen={() => setView({ kind: 'read', id: rep.id })}
              onDrill={() => setView({ kind: 'drill', id: rep.id, name: rep.name })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
