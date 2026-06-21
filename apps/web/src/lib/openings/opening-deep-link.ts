import type { RepertoireSummaryDto } from '@purechess/shared';

export type OpeningDeepLinkAction =
  | { kind: 'drill'; repertoireId: string; name: string }
  | { kind: 'read'; repertoireId: string }
  | { kind: 'lab'; query: string };

type ParsedOpeningHref =
  | { kind: 'repertoire'; id: string }
  | { kind: 'chesscom'; label: string }
  | { kind: 'hub' };

/** Parse `actionHref` values emitted by opening weakness detectors. */
export function parseOpeningActionHref(href: string): ParsedOpeningHref {
  try {
    const url = new URL(href, 'https://purechess.local');
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
  const opening = label.trim().toLowerCase();
  if (!repName || !opening) return false;
  return repName.includes(opening) || opening.includes(repName);
}

/** Map a parsed weakness deep link to the best on-site opening action. */
export function resolveOpeningDeepLink(
  parsed: ParsedOpeningHref,
  repertoires: RepertoireSummaryDto[],
): OpeningDeepLinkAction | null {
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
    return { kind: 'lab', query: parsed.label };
  }

  return null;
}