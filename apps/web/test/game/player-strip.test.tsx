import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { PlayerStrip } from '@/components/game/player-strip';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function clockChip(container: HTMLElement, text: string): HTMLElement {
  const el = Array.from(container.querySelectorAll('div')).find(
    (d) => d.textContent === text && d.className.includes('font-mono'),
  );
  if (!el) throw new Error(`clock chip "${text}" not found`);
  return el as HTMLElement;
}

describe('PlayerStrip clock urgency tiers', () => {
  it('keeps the neutral chip style without timeMs', () => {
    const { container } = render(<PlayerStrip name="You" clock="10:00" />);
    const chip = clockChip(container, '10:00');
    expect(chip.className).toContain('text-muted-foreground');
    expect(chip.className).not.toContain('clock-pulse');
  });

  it('keeps the neutral chip style at 30s+', () => {
    const { container } = render(<PlayerStrip name="You" clock="1:00" timeMs={60_000} />);
    const chip = clockChip(container, '1:00');
    expect(chip.className).toContain('text-muted-foreground');
    expect(chip.className).not.toContain('clock-pulse');
  });

  it('turns amber in the caution band', () => {
    const { container } = render(<PlayerStrip name="You" clock="0:15" timeMs={15_000} />);
    const chip = clockChip(container, '0:15');
    expect(chip.className).toContain('text-[hsl(var(--clock-caution-text))]');
    expect(chip.className).not.toContain('clock-pulse');
  });

  it('pulses red in the critical band', () => {
    const { container } = render(<PlayerStrip name="You" clock="5.0" timeMs={5_000} />);
    const chip = clockChip(container, '5.0');
    expect(chip.className).toContain('text-red-400');
    expect(chip.className).toContain('animate-[clock-pulse_1s_ease-in-out_infinite]');
  });

  it('pulses faster and bolder in the dying band', () => {
    const { container } = render(<PlayerStrip name="You" clock="1.5" timeMs={1_500} />);
    const chip = clockChip(container, '1.5');
    expect(chip.className).toContain('font-bold');
    expect(chip.className).toContain('animate-[clock-pulse_0.4s_ease-in-out_infinite]');
  });

  it('stops pulsing when time is out', () => {
    const { container } = render(<PlayerStrip name="You" clock="0.0" timeMs={0} />);
    const chip = clockChip(container, '0.0');
    expect(chip.className).toContain('text-red-200');
    expect(chip.className).not.toContain('clock-pulse');
  });
});

describe('PlayerStrip increment flash', () => {
  it('flashes brass when timeMs jumps up under 30s, then clears', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <PlayerStrip name="You" clock="5.0" timeMs={5_000} />,
    );
    rerender(<PlayerStrip name="You" clock="8.0" timeMs={8_000} />);
    expect(clockChip(container, '8.0').className).toContain(
      'shadow-[0_0_0_2px_hsl(var(--brass)/0.7)]',
    );
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(clockChip(container, '8.0').className).not.toContain(
      'shadow-[0_0_0_2px_hsl(var(--brass)/0.7)]',
    );
  });

  it('does not flash when the gain lands at 30s or more', () => {
    const { container, rerender } = render(
      <PlayerStrip name="You" clock="1:00" timeMs={60_000} />,
    );
    rerender(<PlayerStrip name="You" clock="1:05" timeMs={65_000} />);
    expect(clockChip(container, '1:05').className).not.toContain(
      'shadow-[0_0_0_2px_hsl(var(--brass)/0.7)]',
    );
  });

  it('does not flash while time drains', () => {
    const { container, rerender } = render(
      <PlayerStrip name="You" clock="8.0" timeMs={8_000} />,
    );
    rerender(<PlayerStrip name="You" clock="7.8" timeMs={7_800} />);
    expect(clockChip(container, '7.8').className).not.toContain(
      'shadow-[0_0_0_2px_hsl(var(--brass)/0.7)]',
    );
  });
});
