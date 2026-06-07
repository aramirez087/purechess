'use client';

import { createContext, useContext, useState } from 'react';
import type { BoardSettings } from '@/lib/board/types';

interface BoardSettingsContextValue {
  settings: BoardSettings;
  updateSettings: (patch: Partial<BoardSettings>) => void;
}

const BoardSettingsContext = createContext<BoardSettingsContextValue | null>(null);

const DEFAULT_SETTINGS: BoardSettings = {
  sound: true,
  coordinates: false,
  animationMs: 200,
};

export function BoardSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<BoardSettings>(DEFAULT_SETTINGS);

  function updateSettings(patch: Partial<BoardSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
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
      settings: DEFAULT_SETTINGS,
      updateSettings: () => {},
    };
  }
  return ctx;
}
