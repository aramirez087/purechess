'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RepertoireDto, RepertoireSummaryDto } from '@purechess/shared';
import {
  deleteRepertoire,
  fetchDrillLines,
  getRepertoire,
  listRepertoires,
} from '@/lib/api/repertoire';
import { RepertoireImport } from '@/components/openings/repertoire-import';
import { RepertoireView } from '@/components/openings/repertoire-view';
import { OpeningDrill } from '@/components/openings/opening-drill';
import { OpeningsHub, OpeningsSignedOut } from '@/components/openings/openings-hub';
import { fetchChessComMistakes } from '@/lib/api/chess-com';
import { openingLabelsMatch } from '@/lib/chess-com/opening-label';
import { mistakeCoachHref } from '@/lib/chess-com/mistake-coach';
import {
  parseOpeningActionHref,
  resolveOpeningDeepLink,
  type OpeningDeepLinkAction,
} from '@/lib/openings/opening-deep-link';

type View =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'read'; id: string }
  | { kind: 'drill'; id: string; name: string };

/**
 * The Openings surface: a didactic hub for the Study → Build → Drill cycle,
 * plus read/drill/import flows. Server-authoritative — trees persist via the
 * `/repertoire` API.
 */
export function OpeningsClient({ signedOut }: { signedOut: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [highlightMistakesLabel, setHighlightMistakesLabel] = useState<string | null>(null);
  const handledDeepLink = useRef<string | null>(null);

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

  const scrollToMistakes = useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById('chess-com-mistakes')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, []);

  const applyOpeningAction = useCallback(
    (action: OpeningDeepLinkAction) => {
      if (action.kind === 'drill') {
        setHighlightMistakesLabel(null);
        setView({ kind: 'drill', id: action.repertoireId, name: action.name });
        return;
      }
      if (action.kind === 'read') {
        setHighlightMistakesLabel(null);
        setView({ kind: 'read', id: action.repertoireId });
        return;
      }
      if (action.kind === 'review-mistakes') {
        setView({ kind: 'list' });
        setHighlightMistakesLabel(action.label);
        scrollToMistakes();
        return;
      }
    },
    [scrollToMistakes],
  );

  const followOpeningActionHref = useCallback(
    async (href: string, repertoires: RepertoireSummaryDto[]) => {
      const action = resolveOpeningDeepLink(parseOpeningActionHref(href), repertoires);
      if (!action) return;

      if (action.kind === 'review-mistakes') {
        try {
          const data = await fetchChessComMistakes();
          const top = data.mistakes
            .filter((m) => !m.reviewed && openingLabelsMatch(m.openingLabel, action.label))
            .sort((a, b) => b.cpLoss - a.cpLoss)[0];
          if (top) {
            router.push(mistakeCoachHref(top));
            return;
          }
        } catch {
          // fall back to highlighting the list
        }
      }

      applyOpeningAction(action);
    },
    [applyOpeningAction, router],
  );

  useEffect(() => {
    if (signedOut || list.isLoading || view.kind !== 'list') return;

    const repertoire = searchParams.get('repertoire');
    const chesscom = searchParams.get('chesscom');
    if (!repertoire && !chesscom) {
      handledDeepLink.current = null;
      return;
    }

    const key = searchParams.toString();
    if (handledDeepLink.current === key) return;
    handledDeepLink.current = key;

    const href = repertoire
      ? `/openings?repertoire=${encodeURIComponent(repertoire)}`
      : `/openings?chesscom=${encodeURIComponent(chesscom!)}`;
    router.replace('/openings', { scroll: false });
    void followOpeningActionHref(href, list.data ?? []);
  }, [
    followOpeningActionHref,
    list.data,
    list.isLoading,
    router,
    searchParams,
    signedOut,
    view.kind,
  ]);

  if (signedOut) {
    return <OpeningsSignedOut />;
  }

  if (view.kind === 'new') {
    return (
      <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col">
        <RepertoireImport onSaved={handleSaved} onCancel={() => setView({ kind: 'list' })} />
      </div>
    );
  }

  if (view.kind === 'read') {
    if (detail.isLoading || !detail.data) {
      return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;
    }
    return (
      <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col">
        <RepertoireView
          repertoire={detail.data}
          onBack={() => setView({ kind: 'list' })}
          onDrill={() =>
            setView({ kind: 'drill', id: detail.data!.id, name: detail.data!.name })
          }
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
      <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col">
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

  return (
    <OpeningsHub
      repertoires={list.data ?? []}
      loading={list.isLoading}
      highlightMistakesLabel={highlightMistakesLabel}
      onNew={() => setView({ kind: 'new' })}
      onOpen={(id) => setView({ kind: 'read', id })}
      onDrill={(id, name) => setView({ kind: 'drill', id, name })}
      onOpeningLeakAction={(href) => followOpeningActionHref(href, list.data ?? [])}
    />
  );
}