'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { applyBoardTheme } from '@/lib/board/themes';
import { soundEngine } from '@/lib/board/sound';
import { prefersReducedMotion } from '@/lib/board/animations';
import type { BoardSettings } from '@/lib/board/types';

interface BoardSettingsContextValue {
  settings: BoardSettings;
  updateSettings: (patch: Partial<BoardSettings>) => void;
}

const BoardSettingsContext = createContext<BoardSettingsContextValue | null>(null);

export function BoardSettingsProvider({ children }: { children: React.ReactNode }) {
  const storeSettings = useSettingsStore();

  useEffect(() => {
    useSettingsStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    applyBoardTheme(storeSettings.boardThemeId);
  }, [storeSettings.boardThemeId]);

  useEffect(() => {
    soundEngine.setEnabled(storeSettings.sound);
  }, [storeSettings.sound]);

  // Reduced-motion is read post-mount only: the server can't know it, and
  // checking during the first client render would mismatch the SSR'd
  // `data-no-animations` attribute. (Attribute-only — never gate an
  // LCP element's visibility on `mounted`, per the S07 rule.)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveAnimations = storeSettings.animations && !(mounted && prefersReducedMotion());
  const animationMs = effectiveAnimations ? 200 : 0;

  const settings: BoardSettings = {
    sound: storeSettings.sound,
    coordinates: storeSettings.coordinates,
    animationMs,
  };

  function updateSettings(patch: Partial<BoardSettings>) {
    const mapped: Parameters<typeof storeSettings.update>[0] = {};
    if (patch.sound !== undefined) mapped.sound = patch.sound;
    if (patch.coordinates !== undefined) mapped.coordinates = patch.coordinates;
    if (patch.animationMs !== undefined) mapped.animations = patch.animationMs > 0;
    storeSettings.update(mapped);
  }

  return (
    <BoardSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </BoardSettingsContext.Provider>
  );
}

export function useBoardSettings(): BoardSettingsContextValue {
  const ctx = useContext(BoardSettingsContext);
  if (!ctx) {
    return {
      settings: { sound: true, coordinates: false, animationMs: 200 },
      updateSettings: () => {},
    };
  }
  return ctx;
}
