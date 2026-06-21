import type { RepertoireSummaryDto } from '@purechess/shared';
import { displayOpeningLabel } from '@/lib/chess-com/opening-label';

export type OpeningDeepLinkAction =
  | { kind: 'drill'; repertoireId: string; name: string }
  | { kind: 'read'; repertoireId: string }
  | { kind: 'lab'; query: string; fen?: string }
  | { kind: 'review-mistakes'; label: string };

export type ParsedOpeningHref =
  | { kind: 'repertoire'; id: string }
  | { kind: 'chesscom'; label: string }
  | { kind: 'lab'; query: string; fen?: string }
  | { kind: 'hub' };

/** Parse `actionHref` values emitted by opening weakness detectors. */
export function parseOpeningActionHref(href: string): ParsedOpeningHref {
  try {
    const url = new URL(href, 'https://purechess.local');

    if (url.pathname.includes('/openings/lab')) {
      const query = url.searchParams.get('q');
      const fen = url.searchParams.get('fen');
      if (query || fen) {
        return {
          kind: 'lab',
          query: query ? decodeURIComponent(query) : '',
          fen: fen ?? undefined,
        };
      }
    }

    const repertoire = url.searchParams.get('repertoire');
    if (repertoire) return { kind: 'repertoire', id: repertoire };

    const chesscom = url.searchParams.get('chesscom');
    if (chesscom) return { kind: 'chesscom', label: decodeURIComponent(chesscom) };

    return { kind: 'hub' };
  } catch {
    return { kind: 'hub' };
  }
}

function repertoireMatchesOpeningLabel(rep: RepertoireSummaryDto, label: string): boolean {
  const repName = rep.name.trim().toLowerCase();
  const opening = displayOpeningLabel(label).trim().toLowerCase();
  if (!repName || !opening) return false;
  return repName.includes(opening) || opening.includes(repName);
}

/** Map a parsed weakness deep link to the best on-site opening action. */
export function resolveOpeningDeepLink(
  parsed: ParsedOpeningHref,
  repertoires: RepertoireSummaryDto[],
): OpeningDeepLinkAction | null {
  if (parsed.kind === 'lab') {
    // Legacy insights links pointed at Opening Lab — treat as chess.com mistake review.
    return { kind: 'review-mistakes', label: parsed.query };
  }

  if (parsed.kind === 'repertoire') {
    const rep = repertoires.find((r) => r.id === parsed.id);
    if (!rep) return null;
    if (rep.lineCount > 0) {
      return { kind: 'drill', repertoireId: rep.id, name: rep.name };
    }
    return { kind: 'read', repertoireId: rep.id };
  }

  if (parsed.kind === 'chesscom') {
    const match = repertoires.find(
      (r) => r.lineCount > 0 && repertoireMatchesOpeningLabel(r, parsed.label),
    );
    if (match) {
      return { kind: 'drill', repertoireId: match.id, name: match.name };
    }
    return { kind: 'review-mistakes', label: parsed.label };
  }

  return null;
}

/** Build the Opening Lab URL for browsing named lines. */
export function openingLabHref(query: string, fen?: string): string {
  const params = new URLSearchParams();
  const label = displayOpeningLabel(query);
  if (label.trim()) params.set('q', label.trim());
  if (fen) params.set('fen', fen);
  const qs = params.toString();
  return qs ? `/openings/lab?${qs}` : '/openings/lab';
}