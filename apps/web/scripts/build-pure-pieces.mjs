// Generates the "pure" piece set in public/pieces/pure/ from the vendored
// cburnett set (public/pieces/cburnett/). Same geometry — cburnett silhouettes
// are the most readable in the wild — with material depth injected:
//
//   - white bodies: flat #fff        -> vertical ivory gradient (url(#pw))
//   - black bodies: flat/implicit #000 -> vertical graphite gradient (url(#pb))
//   - outlines:     pure #000        -> warm ink (white) / near-black (black)
//   - detail lines: cool #ececec     -> warm bone, echoing the board palette
//
// The gradients use userSpaceOnUse across the 45x45 viewBox so the whole piece
// reads as one object lit from above, not per-path restarts.
//
// Derivative of cburnett (Colin M.L. Burnett, CC-BY-SA 3.0) — see
// public/pieces/ATTRIBUTION.md. Rerun after tweaking the recipe:
//   node scripts/build-pure-pieces.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../public/pieces/cburnett');
const outDir = join(here, '../public/pieces/pure');

const WHITE_INK = '#3f3a2f'; // outlines + detail dots on white pieces
const BLACK_INK = '#15130f'; // outlines on black pieces
const BONE_DETAIL = '#d7d0be'; // accent lines on black pieces (was #ececec)

// White bottom stop must stay clearly darker than the light squares
// (classic bone #ddd6c0, walnut tan #dac4a4) or piece feet tonally merge
// into the board wherever the surface sheen doesn't darken the square.
const DEFS = `<defs><linearGradient id="pw" x1="22.5" y1="5" x2="22.5" y2="40" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fffef8"/><stop offset=".55" stop-color="#f1ebda"/><stop offset="1" stop-color="#cbc1a4"/></linearGradient><linearGradient id="pb" x1="22.5" y1="5" x2="22.5" y2="40" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5b5750"/><stop offset=".45" stop-color="#36332d"/><stop offset="1" stop-color="#1a1814"/></linearGradient></defs>`;

mkdirSync(outDir, { recursive: true });

for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.svg'))) {
  let svg = readFileSync(join(srcDir, file), 'utf8');
  const isWhite = file.startsWith('w');

  if (isWhite) {
    svg = svg
      .replaceAll('fill="#fff"', 'fill="url(#pw)"')
      .replaceAll('fill="#000"', `fill="${WHITE_INK}"`) // wN eye/nostril
      .replaceAll('stroke="#000"', `stroke="${WHITE_INK}"`);
  } else {
    svg = svg
      .replaceAll('fill="#000"', 'fill="url(#pb)"')
      .replaceAll('stroke="#000"', `stroke="${BLACK_INK}"`)
      .replaceAll('#ececec', BONE_DETAIL);
    // bQ/bR rely on SVG's implicit black fill on the outer group; bP on the
    // bare path. Make the gradient the explicit default for those shapes.
    svg = svg
      .replace('<g fill-rule="evenodd"', '<g fill="url(#pb)" fill-rule="evenodd"')
      .replace(/<path stroke="(#[0-9a-f]+)" stroke-linecap="round" stroke-width="1.5" d="M22.5 9/, '<path fill="url(#pb)" stroke="$1" stroke-linecap="round" stroke-width="1.5" d="M22.5 9');
    // bQ's five crown orbs are the set's only unstroked shapes at the very top
    // of the gradient (cy 8-12, the lightest band) — on the gradient they read
    // as ghosted gray dots. Pin them to a fixed near-ink fill instead.
    svg = svg.replace('<g stroke="none">', '<g fill="#26231e" stroke="none">');
  }

  svg = svg.replace('viewBox="0 0 45 45">', `viewBox="0 0 45 45">${DEFS}`);
  writeFileSync(join(outDir, file), svg);
  console.log(`pure/${file}`);
}
