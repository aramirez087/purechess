import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CapturedMaterial } from '@/components/game/captured-material';
import type { PieceType } from '@purechess/shared';

describe('CapturedMaterial', () => {
  it('renders nothing when there is no material and no advantage', () => {
    const { container } = render(<CapturedMaterial pieces={[]} advantage={0} color="b" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one glyph per captured piece', () => {
    const pieces: PieceType[] = ['q', 'p', 'p', 'p'];
    const { container } = render(<CapturedMaterial pieces={pieces} advantage={3} color="b" />);
    expect(container.querySelectorAll('img')).toHaveLength(4);
  });

  it('stacks same-type pieces into one overlapping group per type', () => {
    const pieces: PieceType[] = ['r', 'p', 'p', 'p'];
    const { container } = render(<CapturedMaterial pieces={pieces} advantage={0} color="w" />);

    // Two type groups: [r], [p, p, p].
    const groupsWrapper = container.querySelector('.gap-1');
    expect(groupsWrapper).not.toBeNull();
    const groups = groupsWrapper!.children;
    expect(groups).toHaveLength(2);
    expect(groups[0].querySelectorAll('img')).toHaveLength(1);
    expect(groups[1].querySelectorAll('img')).toHaveLength(3);

    // Within a group, every glyph after the first pulls left (overlap stack);
    // the first glyph of each group does not.
    const pawnImgs = [...groups[1].querySelectorAll('img')];
    expect(pawnImgs[0].className).not.toMatch(/-ml-/);
    expect(pawnImgs[1].className).toMatch(/-ml-/);
    expect(pawnImgs[2].className).toMatch(/-ml-/);
    const rookImg = groups[0].querySelector('img');
    expect(rookImg!.className).not.toMatch(/-ml-/);
  });

  it('shows the advantage chip only when positive', () => {
    const { getByText, rerender, queryByText } = render(
      <CapturedMaterial pieces={['p']} advantage={1} color="b" />,
    );
    expect(getByText('+1')).toBeTruthy();
    rerender(<CapturedMaterial pieces={['p']} advantage={-2} color="b" />);
    expect(queryByText(/^\+/)).toBeNull();
  });
});
