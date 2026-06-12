/**
 * Registry of the available piece sets. Server-safe (no React, no stores) so
 * route loading shells can import the default set's base path for sprite
 * preloads without pulling client code.
 *
 * Both sets are generated derivatives of the vendored cburnett geometry — see
 * `apps/web/scripts/` for the build scripts and `public/pieces/ATTRIBUTION.md`
 * for licensing.
 */

export type PieceSetId = 'sculpted' | 'pure';

export interface PieceSet {
  id: PieceSetId;
  label: string;
  /** Public base path holding the 12 `{w|b}{P|N|B|R|Q|K}.svg` sprites. */
  base: string;
  description: string;
}

export const PIECE_SETS: PieceSet[] = [
  {
    id: 'sculpted',
    label: 'Sculpted',
    base: '/pieces/sculpted',
    description: 'Directional light, speculars, and deeper material shading.',
  },
  {
    id: 'pure',
    label: 'Pure',
    base: '/pieces/pure',
    description: 'Flat ivory and graphite gradients. Quieter.',
  },
];

export const DEFAULT_PIECE_SET: PieceSetId = 'sculpted';

const BASE_BY_ID = new Map(PIECE_SETS.map((s) => [s.id, s.base]));

/**
 * Base path for a set id, falling back to the default for unknown ids (e.g.
 * the legacy persisted `'standard'` value from before the picker existed).
 */
export function pieceSetBase(id: string): string {
  return BASE_BY_ID.get(id as PieceSetId) ?? BASE_BY_ID.get(DEFAULT_PIECE_SET)!;
}
