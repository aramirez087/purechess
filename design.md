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
- Board light: `hsl(44 26% 78%)`
- Board dark: `hsl(142 16% 34%)`
- Accent brass: `#d6b563`
- Danger: `#ef4444`

## Typography

Use the existing Geist Sans and Geist Mono stack. The product should be typographically restrained:

- Player names and status: medium weight, compact tracking.
- Notation: mono or tabular numerals for scan speed.
- Buttons: small, direct labels with icons where available.

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

- Board frame: thin border, 6px radius, subtle shadow, no ornate container.
- Player strips: compact rows above and below the board with color, side, and status.
- Thinking state: centered translucent overlay with a spinner, never a full-page interruption.
- Result state: compact banner in the board column, not a modal.
- Move list: tabular rows with number, white move, black move. The latest row may be slightly stronger.
- Resign: icon plus label, quiet outline by default, clear red hover/focus state.

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
