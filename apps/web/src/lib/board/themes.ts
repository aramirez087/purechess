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
    light: '#d4c89a',
    dark: '#8b6914',
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
