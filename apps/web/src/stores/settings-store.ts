'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BoardThemeId } from '@/lib/board/themes';

export interface Settings {
  appTheme: 'light' | 'dark' | 'system';
  boardThemeId: BoardThemeId;
  coordinates: boolean;
  sound: boolean;
  lowTimeSound: boolean;
  animations: boolean;
  pieceSet: 'standard';
}

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const DEFAULTS: Settings = {
  appTheme: 'system',
  boardThemeId: 'classic',
  coordinates: false,
  sound: true,
  lowTimeSound: false,
  animations: true,
  pieceSet: 'standard',
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      update: (patch) => set((state) => ({ ...state, ...patch })),
      reset: () => set((state) => ({ ...state, ...DEFAULTS })),
    }),
    {
      name: 'purchess-settings',
      skipHydration: true,
    }
  )
);

export { DEFAULTS as SETTINGS_DEFAULTS };
