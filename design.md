# Purechess Design Direction

## North Star

Purechess should feel like a private tournament room: quiet, exact, and premium without visual noise. The board is the product. Every surrounding element exists only to support the next move.

## Aesthetic

Name: Silent Tournament

The interface uses a near-black stage, mineral green board tones, ivory pieces, and one restrained brass accent. The result should feel minimal and memorable: fewer surfaces, stronger alignment, larger board, tighter notation, and no decorative clutter.

## Principles

1. Board first.
   The chessboard owns the visual hierarchy. On desktop it should be the largest element on the page; on mobile it should appear before secondary controls.

2. Quiet chrome.
   Panels, labels, and controls use low-contrast borders and small typography. Nothing competes with the board.

3. Information at the edge.
   Game state belongs in compact player strips and the notation rail, not in large instructional blocks.

4. Intentional tension.
   Use a single accent for active status, last moves, focus, and primary feedback. Destructive actions stay red but subdued until hover.

5. Dense, not cramped.
   Chess players scan repeatedly. Spacing should be predictable, notation should be tabular, and controls should stay in stable positions.

## Palette

- Stage: `#0b0d0b`
- Surface: `#121511`
- Raised surface: `#181c17`
- Border: `#2b332c`
- Text: `#f1eee6`
- Muted text: `#9da79c`
- Board light (bone): `hsl(46 30% 81%)`
- Board dark (mineral): `hsl(138 14% 36%)`
- Accent brass: `#d6b563`
- Danger: `#ef4444`

Board highlights are brass-family washes layered OVER the square colour
(never replacing it): last move `hsl(41 78% 55% / 0.4)`, selected
`hsl(41 85% 56% / 0.5)`, check is a red radial glow, legal moves are small
dark dots / a dark ring on captures.

## Typography

Three voices, each with one job:

- **Display: Fraunces** (`--font-display`, variable, opsz + italic). Used
  only for page-level headlines and brand moments — the home hero, the
  play-mode prompt, result states. Italic Fraunces is the signature flourish
  ("the product."). Never used inside the game chrome.
- **Body: Geist Sans.** Everything functional. Player names and status:
  medium weight, compact tracking.
- **Notation: Geist Mono.** Move lists, clocks, coordinates, numerals —
  always tabular.

The game screens stay typographically silent (sans + mono only); the serif
voice exists so the marketing/landing surfaces feel like a private club
invitation rather than a SaaS template.

## Layout

Desktop:

- Center a two-column playing surface with the board column and a narrow notation rail.
- Keep the board column between 560px and 720px.
- Keep the moves rail around 320px wide.
- Align the top of the move rail with the board frame.

Mobile:

- Stack status, board, actions, then moves.
- Avoid fixed heights that force the board below the fold.
- Keep action buttons full-width and thumb-friendly.

## Component Rules

- Board frame: dark gradient frame, 14px outer radius, inner playing surface
  clipped at 7px with a hairline; deep shadow plus a faint brass halo.
- Coordinates: in-square corner labels (ranks top-right of the last file,
  files bottom-left of the last rank), tinted with the opposite square
  colour. No gutters around the board.
- Pieces: vendored cburnett SVGs at ~92% of the square (4% padding), soft
  2px drop shadow. Pieces must never touch square edges.
- Player strips: compact rows above and below the board with color, side, and status.
- Thinking state: centered translucent overlay with a spinner, never a full-page interruption.
- Result state: the one theatrical moment in the product. A board overlay with
  the verdict as a large italic Fraunces word — "Checkmate." / "Stalemate." /
  "Victory." / "Defeat." / "Draw." — over a small-caps outcome line and a
  brass hairline; the mechanical reason ("by resignation") stays small. The
  rail banner echoes it in smaller italic serif.
- Move list: a printed score sheet — ruled hairlines, right-aligned move
  numbers with periods, tabular mono SAN, and a 2px brass left bar marking
  the current ply. Empty state is italic serif.
- Home hero art: a static rendering of the Immortal Game's final position
  (Anderssen–Kieseritzky 1851, 23.Be7#) in the real board palette with the
  mating squares highlighted — the literal product as the hero image, with a
  small-caps mono caption.
- Move list: tabular rows with number, white move, black move. The latest row may be slightly stronger.
- Resign: icon plus label, quiet outline by default, clear red hover/focus state.

## Primary Action Color: brass is the door

Two primary-button voices exist on purpose, and the split is by meaning,
not by page:

- **Solid brass (`bg-brass`)** is reserved for *crossing the threshold into
  the club*: the auth forms (sign in / create account) and nothing else.
  Brass at full strength marks the one decision that changes who you are to
  the product. Hero/landing CTAs that lead toward auth may use the brass
  *tint* recipes (border + wash), never a second solid-brass block per view.
- **Bone (`bg-foreground text-background`)** is the in-app primary: start a
  game, accept an invite, copy a link, analyze. Inside the club everything
  competes only with the board, so the strongest neutral wins.

Rule of thumb: if the user is not signed in and the action signs them in,
it may be solid brass. Otherwise it is bone. Do not introduce new
solid-brass fills; the accent budget is already spent on status, last-move
washes, selection, and the auth door.

## Motion

Motion should be functional:

- Existing piece movement remains the main animation.
- Thinking spinner is acceptable.
- Avoid page choreography, parallax, decorative gradients, and visual effects that draw attention away from the position.

## Accessibility

- Preserve board grid semantics and keyboard movement.
- Keep focus rings visible against the dark stage.
- Maintain WCAG AA contrast for labels and controls.
- Do not encode status by color alone; pair active dots/spinners with text.

## Current Implementation Target

Apply this direction first to `/computer-game/[gameId]`:

- Replace the loose page layout with a centered board-first match workspace.
- Add compact computer and player strips.
- Restyle the moves panel into a notation rail.
- Tune board colors and move highlights globally.
- Preserve all existing game behavior and API calls.
