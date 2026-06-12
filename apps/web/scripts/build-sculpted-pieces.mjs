// Generates the "sculpted" piece set in public/pieces/sculpted/ from the
// vendored cburnett set (public/pieces/cburnett/). Same geometry as the
// "pure" set (build-pure-pieces.mjs) but with a directional-light material
// pass on top:
//
//   - diagonal body gradients (light from the upper-left, not straight down)
//   - per-piece specular highlights on domes/heads/orbs (radial gradients
//     positioned against the known cburnett geometry in the 45x45 viewBox)
//   - soft ambient-occlusion pool at the base of white pieces
//
// Derivative of cburnett (Colin M.L. Burnett, CC-BY-SA 3.0) — see
// public/pieces/ATTRIBUTION.md. Rerun after tweaking the recipe:
//   node scripts/build-sculpted-pieces.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../public/pieces/cburnett');
const outDir = join(here, '../public/pieces/sculpted');

const WHITE_INK = '#3f3a2f';
const BLACK_INK = '#15130f';
const BONE_DETAIL = '#d7d0be';

// Diagonal gradients (userSpaceOnUse across the whole 45x45 piece) so every
// piece reads as one object under a single upper-left key light. The white
// bottom stop stays clearly darker than the light squares (classic bone
// #ddd6c0, walnut tan #dac4a4) so piece feet never merge into the board.
const DEFS = `<defs><linearGradient id="sw" x1="12" y1="2" x2="32" y2="43" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fffef9"/><stop offset=".35" stop-color="#f6f1e3"/><stop offset=".7" stop-color="#e4dcc4"/><stop offset="1" stop-color="#c4b894"/></linearGradient><linearGradient id="sb" x1="12" y1="2" x2="32" y2="43" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#615c54"/><stop offset=".4" stop-color="#3c3933"/><stop offset=".75" stop-color="#262420"/><stop offset="1" stop-color="#141210"/></linearGradient><radialGradient id="spec" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".55" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><radialGradient id="ao" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>`;

// Specular/sheen overlays per piece letter, positioned against the cburnett
// geometry (shared by both colors). Painted after the piece group, so keep
// alphas low enough not to wash detail strokes. White pieces are matte ivory
// (softer speculars); black pieces are polished graphite (glossier).
function overlays(letter, isWhite) {
  const s = (v) => (isWhite ? v.w : v.b); // per-color alpha
  const E = (cx, cy, rx, ry, o, rot) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#spec)" opacity="${o}"${
      rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''
    }/>`;
  const AO = (cx, cy, rx, ry, o) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#ao)" opacity="${o}"/>`;

  switch (letter) {
    case 'P':
      return [
        E(21, 11.7, 2.5, 2.1, s({ w: 0.5, b: 0.42 })), // head dome
        E(19.8, 19.5, 3.2, 2.0, s({ w: 0.22, b: 0.16 }), -18), // shoulder
        isWhite ? AO(22.5, 38, 9.5, 1.8, 0.16) : '',
      ].join('');
    case 'B':
      return [
        E(21.8, 7.3, 1.3, 1.1, s({ w: 0.55, b: 0.48 })), // top ball
        E(20.2, 15.5, 2.6, 3.6, s({ w: 0.26, b: 0.2 }), -12), // mitre dome
        isWhite ? AO(22.5, 36.5, 10.5, 1.8, 0.15) : '',
      ].join('');
    case 'N':
      return [
        E(26.5, 11.4, 2.0, 1.0, s({ w: 0.22, b: 0.22 }), -18), // mane-top ridge — ~12 units from the eye at (14.5,15.5), so no second-eye read
        E(26, 20.5, 2.0, 4.5, s({ w: 0.18, b: 0.2 }), 16), // neck ridge, upper-left of the chest curve where the key light lands
        isWhite ? AO(25.5, 38.2, 10.5, 1.7, 0.15) : '',
      ].join('');
    case 'R':
      return [
        E(20, 18.6, 5.5, 1.7, s({ w: 0.22, b: 0.17 })), // shelf under crenellation
        E(17.5, 24.5, 2.4, 5.0, s({ w: 0.16, b: 0.12 })), // left tower face
        isWhite ? AO(22.5, 38.3, 11, 1.7, 0.15) : '',
      ].join('');
    case 'Q': {
      // Tiny glints on the five crown orbs (centers from the cburnett paths).
      const orbCenters = [
        [6, 12],
        [14, 9],
        [22.5, 8],
        [31, 9],
        [39, 12],
      ];
      // Glint sized for the BLACK queen's r=2.75 unstroked orbs (max extent
      // 1.35+1.4=2.75 stays inside); on white the glint is white-on-white
      // and harmlessly invisible.
      const glints = orbCenters
        .map(([cx, cy]) => E(cx - 0.9, cy - 1.0, 1.4, 1.2, s({ w: 0.6, b: 0.62 })))
        .join('');
      return [
        glints,
        // Central spike face — the earlier (18.5,20.5) panel straddled the
        // open V-notch between spikes and glazed bare background.
        E(22.3, 19, 1.5, 3.4, s({ w: 0.2, b: 0.15 }), -8),
        isWhite ? AO(22.5, 38.2, 12, 1.7, 0.15) : '',
      ].join('');
    }
    case 'K':
      return [
        E(21.8, 15.5, 1.9, 3.0, s({ w: 0.28, b: 0.22 })), // tunic front
        E(14, 20.5, 2.8, 3.2, s({ w: 0.22, b: 0.17 }), -16), // left crown lobe
        isWhite ? AO(22.5, 37.8, 10, 1.7, 0.15) : '',
      ].join('');
    default:
      return '';
  }
}

mkdirSync(outDir, { recursive: true });

for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.svg'))) {
  let svg = readFileSync(join(srcDir, file), 'utf8');
  const isWhite = file.startsWith('w');
  const letter = file[1];

  if (isWhite) {
    svg = svg
      .replaceAll('fill="#fff"', 'fill="url(#sw)"')
      .replaceAll('fill="#000"', `fill="${WHITE_INK}"`) // wN eye/nostril
      .replaceAll('stroke="#000"', `stroke="${WHITE_INK}"`);
  } else {
    svg = svg
      .replaceAll('fill="#000"', 'fill="url(#sb)"')
      .replaceAll('stroke="#000"', `stroke="${BLACK_INK}"`)
      .replaceAll('#ececec', BONE_DETAIL);
    // bQ/bR rely on SVG's implicit black fill on the outer group; bP on the
    // bare path. Make the gradient the explicit default for those shapes.
    svg = svg
      .replace('<g fill-rule="evenodd"', '<g fill="url(#sb)" fill-rule="evenodd"')
      .replace(
        /<path stroke="(#[0-9a-f]+)" stroke-linecap="round" stroke-width="1.5" d="M22.5 9/,
        '<path fill="url(#sb)" stroke="$1" stroke-linecap="round" stroke-width="1.5" d="M22.5 9',
      );
    // bQ's crown orbs are the set's only unstroked shapes at the top of the
    // gradient — pin them to near-ink so they don't ghost (the per-orb spec
    // glints then read as polished beads).
    svg = svg.replace('<g stroke="none">', '<g fill="#26231e" stroke="none">');
  }

  svg = svg.replace('viewBox="0 0 45 45">', `viewBox="0 0 45 45">${DEFS}`);
  svg = svg.replace('</svg>', `<g aria-hidden="true">${overlays(letter, isWhite)}</g></svg>`);
  writeFileSync(join(outDir, file), svg);
  console.log(`sculpted/${file}`);
}
