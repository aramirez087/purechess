export type BoardThemeId = 'classic' | 'walnut' | 'tournament' | 'ocean' | 'mono';

export interface BoardTheme {
  id: BoardThemeId;
  label: string;
  light: string;
  dark: string;
}

// Swatches mirror the `:root[data-board-theme='…']` HSL vars in globals.css —
// keep both in sync when adding or tuning a theme.
export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'classic',
    label: 'Classic',
    light: '#dcd6c1',
    dark: '#4f6959',
  },
  {
    id: 'walnut',
    label: 'Walnut',
    light: '#dac4a4',
    dark: '#876145',
  },
  {
    id: 'tournament',
    label: 'Tournament',
    light: '#ebecd0',
    dark: '#759457',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    light: '#c4d3de',
    dark: '#51708a',
  },
  {
    id: 'mono',
    label: 'Mono',
    light: '#e5e5e5',
    dark: '#404040',
  },
];

export function applyBoardTheme(themeId: BoardThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-board-theme', themeId);
}
