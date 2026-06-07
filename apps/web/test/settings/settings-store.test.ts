import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, SETTINGS_DEFAULTS } from '@/stores/settings-store';

beforeEach(() => {
  useSettingsStore.setState({ ...SETTINGS_DEFAULTS });
});

describe('settings store', () => {
  it('has correct defaults', () => {
    const s = useSettingsStore.getState();
    expect(s.appTheme).toBe('system');
    expect(s.boardThemeId).toBe('classic');
    expect(s.coordinates).toBe(false);
    expect(s.sound).toBe(true);
    expect(s.lowTimeSound).toBe(false);
    expect(s.animations).toBe(true);
    expect(s.pieceSet).toBe('standard');
  });

  it('mutation updates store', () => {
    useSettingsStore.getState().update({ coordinates: true });
    expect(useSettingsStore.getState().coordinates).toBe(true);
  });

  it('mutation notifies subscribers', () => {
    const received: boolean[] = [];
    const unsub = useSettingsStore.subscribe((s) => received.push(s.sound));
    useSettingsStore.getState().update({ sound: false });
    unsub();
    expect(received).toContain(false);
  });

  it('reset restores defaults', () => {
    useSettingsStore.getState().update({ sound: false, coordinates: true, boardThemeId: 'mono' });
    useSettingsStore.getState().reset();
    const s = useSettingsStore.getState();
    expect(s.sound).toBe(true);
    expect(s.coordinates).toBe(false);
    expect(s.boardThemeId).toBe('classic');
  });

  it('lowTimeSound toggles independently of sound', () => {
    useSettingsStore.getState().update({ sound: true, lowTimeSound: true });
    expect(useSettingsStore.getState().lowTimeSound).toBe(true);
    useSettingsStore.getState().update({ lowTimeSound: false });
    expect(useSettingsStore.getState().lowTimeSound).toBe(false);
    expect(useSettingsStore.getState().sound).toBe(true);
  });

  it('persist round-trip: key is purechess-settings', () => {
    const persistKey = (useSettingsStore as unknown as { persist: { getOptions: () => { name: string } } }).persist.getOptions().name;
    expect(persistKey).toBe('purechess-settings');
  });
});
