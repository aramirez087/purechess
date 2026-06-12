'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BoardThemeId } from '@/lib/board/themes';
import { DEFAULT_PIECE_SET, PIECE_SETS, type PieceSetId } from '@/lib/board/piece-sets';

export interface Settings {
  appTheme: 'light' | 'dark' | 'system';
  boardThemeId: BoardThemeId;
  coordinates: boolean;
  sound: boolean;
  lowTimeSound: boolean;
  animations: boolean;
  pieceSet: PieceSetId;
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
  pieceSet: DEFAULT_PIECE_SET,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      update: (patch) => set((state) => ({ ...state, ...patch })),
      reset: () => set((state) => ({ ...state, ...DEFAULTS })),
    }),
    {
      name: 'purechess-settings',
      skipHydration: true,
      // Normalize at the boundary so the store always satisfies its declared
      // types: pre-picker envelopes persisted the placeholder
      // pieceSet: 'standard', which would otherwise live in the store (and
      // re-persist) forever as a value outside PieceSetId.
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<Settings>) };
        if (!PIECE_SETS.some((s) => s.id === merged.pieceSet)) {
          merged.pieceSet = DEFAULT_PIECE_SET;
        }
        return merged;
      },
    }
  )
);

export { DEFAULTS as SETTINGS_DEFAULTS };
