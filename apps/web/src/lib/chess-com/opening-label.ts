import { ECO_OPENINGS, lookupByName } from '@/lib/openings';

const ECO_CODE_RE = /^[A-E]\d{2}[a-z]?$/i;

/** Turn stored chess.com / PGN labels into a human opening name (e.g. C20 → King's Pawn Game). */
export function displayOpeningLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return 'your opening';

  if (ECO_CODE_RE.test(trimmed)) {
    const code = trimmed.toUpperCase();
    const byCode = ECO_OPENINGS.find((e) => e.code.toUpperCase() === code);
    if (byCode) return byCode.name;
  }

  const byName = lookupByName(trimmed);
  if (byName) return byName.name;

  return trimmed;
}

/** Canonical label for persistence and clustering. */
export function normalizeOpeningLabel(label: string): string {
  return displayOpeningLabel(label);
}

/** Match labels across ECO codes and human names (C20 ↔ King's Pawn Game). */
export function openingLabelsMatch(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  return normalizeOpeningLabel(a).toLowerCase() === normalizeOpeningLabel(b).toLowerCase();
}