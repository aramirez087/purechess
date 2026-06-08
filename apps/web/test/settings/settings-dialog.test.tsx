import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSettingsStore, SETTINGS_DEFAULTS } from '@/stores/settings-store';

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'system', setTheme: vi.fn() }),
}));

vi.mock('@/lib/board/animations', () => ({
  prefersReducedMotion: vi.fn(() => false),
}));

import { SettingsForm } from '@/components/settings/settings-form';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { prefersReducedMotion } from '@/lib/board/animations';

beforeEach(() => {
  useSettingsStore.setState({ ...SETTINGS_DEFAULTS });
  vi.mocked(prefersReducedMotion).mockReturnValue(false);
});

describe('SettingsDialog', () => {
  it('dialog closed by default', () => {
    render(<SettingsDialog />);
    expect(screen.queryByText('Sound effects')).toBeNull();
  });

  it('trigger opens dialog', () => {
    render(<SettingsDialog />);
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }));
    expect(screen.getByText('Sound effects')).toBeTruthy();
  });
});

describe('SettingsForm', () => {
  it('board theme button changes boardThemeId in store', () => {
    render(<SettingsForm />);
    const monoButton = screen.getByRole('button', { name: /mono/i });
    fireEvent.click(monoButton);
    expect(useSettingsStore.getState().boardThemeId).toBe('mono');
  });

  it('lowTimeSound switch disabled when sound is off', () => {
    useSettingsStore.setState({ ...SETTINGS_DEFAULTS, sound: false });
    render(<SettingsForm />);
    const lowTimeSwitch = screen.getByRole('switch', { name: /low-time tick/i });
    expect(lowTimeSwitch).toBeDisabled();
  });

  it('animations toggle updates store', () => {
    render(<SettingsForm />);
    const animSwitch = screen.getByRole('switch', { name: /animations/i });
    fireEvent.click(animSwitch);
    expect(useSettingsStore.getState().animations).toBe(false);
  });

  it('prefers-reduced-motion disables animations switch and shows note', () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true);
    render(<SettingsForm />);
    const animSwitch = screen.getByRole('switch', { name: /animations/i });
    expect(animSwitch).toBeDisabled();
    expect(screen.getByText(/reduced-motion/i)).toBeTruthy();
  });
});
