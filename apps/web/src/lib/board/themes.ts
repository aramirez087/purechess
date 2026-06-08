export type BoardThemeId = 'classic' | 'mono';

export interface BoardTheme {
  id: BoardThemeId;
  label: string;
  light: string;
  dark: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'classic',
    label: 'Classic',
    light: '#e7ead0',
    dark: '#6e9152',
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
