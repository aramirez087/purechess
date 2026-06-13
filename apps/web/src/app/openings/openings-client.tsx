'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus } from 'lucide-react';
import type { RepertoireDto, RepertoireSummaryDto } from '@purechess/shared';
import {
  deleteRepertoire,
  getRepertoire,
  listRepertoires,
} from '@/lib/api/repertoire';
import { Button } from '@/components/ui/button';
import { RepertoireImport } from '@/components/openings/repertoire-import';
import { RepertoireView } from '@/components/openings/repertoire-view';
import { cn } from '@/lib/utils';

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'read'; id: string };

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
}: {
  rep: RepertoireSummaryDto;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-4 rounded-[10px] border border-border bg-surface/60 px-4 py-3.5 text-left transition-colors hover:border-brass/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{rep.name}</span>
          <ColorChip color={rep.color} />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {rep.lineCount} line{rep.lineCount === 1 ? '' : 's'} · {rep.nodeCount} move
          {rep.nodeCount === 1 ? '' : 's'} · {lastTrainedLabel(rep.lastTrainedAt)}
        </p>
      </div>
      <span className="shrink-0 text-sm text-brass">Open</span>
    </button>
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

  // view.kind === 'list'
  const repertoires = list.data ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl italic text-foreground">Openings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your repertoire — the lines you play, stored as a tree.
          </p>
        </div>
        <Button onClick={() => setView({ kind: 'new' })}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New repertoire
        </Button>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
