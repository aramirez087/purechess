import { preload } from 'react-dom';
import { GameLoadingSkeleton } from '@/components/game/game-loading-skeleton';

// All 12 piece sprites (~48 kB total). Preloading from the loading shell —
// which flushes before the server finishes the state fetch — lets the images
// download alongside the streamed board HTML instead of after it, so the LCP
// piece <img> paints as soon as the markup lands.
const PIECE_SPRITES = ['P', 'N', 'B', 'R', 'Q', 'K'].flatMap((p) => [
  `/pieces/cburnett/w${p}.svg`,
  `/pieces/cburnett/b${p}.svg`,
]);

/** Route-level loading UI for /computer-game/[gameId]. */
export default function ComputerGameLoading() {
  for (const href of PIECE_SPRITES) {
    preload(href, { as: 'image' });
  }
  return <GameLoadingSkeleton />;
}
