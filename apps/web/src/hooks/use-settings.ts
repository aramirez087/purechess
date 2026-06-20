'use client';

import { useSettingsStore, type Settings } from '@/stores/settings-store';

export function useSettings(): Settings {
  return useSettingsStore((s) => ({
    appTheme: s.appTheme,
    boardThemeId: s.boardThemeId,
    coordinates: s.coordinates,
    sound: s.sound,
    lowTimeSound: s.lowTimeSound,
    animations: s.animations,
    pieceSet: s.pieceSet,
    showEvalBar: s.showEvalBar,
    hideExplanations: s.hideExplanations,
    playPreferences: s.playPreferences,
  }));
}

export function useUpdateSettings() {
  return useSettingsStore((s) => s.update);
}

export function useResetSettings() {
  return useSettingsStore((s) => s.reset);
}
