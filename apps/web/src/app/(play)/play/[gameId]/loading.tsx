import { preload } from 'react-dom';
import { GameLoadingSkeleton } from '@/components/game/game-loading-skeleton';
import { DEFAULT_PIECE_SET, pieceSetBase } from '@/lib/board/piece-sets';

// All 12 piece sprites (~48 kB total). Preloading from the loading shell —
// which flushes before the server finishes the state fetch — lets the images
// download alongside the streamed board HTML instead of after it, so the LCP
// piece <img> paints as soon as the markup lands. The user's piece-set choice
// lives client-side, so only the default set is preloaded; non-default users
// pay one extra (cached-after-first) fetch.
const PIECE_SPRITES = ['P', 'N', 'B', 'R', 'Q', 'K'].flatMap((p) => [
  `${pieceSetBase(DEFAULT_PIECE_SET)}/w${p}.svg`,
  `${pieceSetBase(DEFAULT_PIECE_SET)}/b${p}.svg`,
]);

/** Route-level loading UI for /play/[gameId]. */
export default function LiveGameLoading() {
  for (const href of PIECE_SPRITES) {
    preload(href, { as: 'image' });
  }
  return <GameLoadingSkeleton />;
}
