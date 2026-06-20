'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChessComOpeningMistakeCandidateDto } from '@purechess/shared';
import {
  completeChessComSync,
  fetchChessComGames,
  saveChessComMistakes,
} from '@/lib/api/chess-com';
import { analyzeChessComGameOpening } from '@/lib/chess-com/opening-analyzer';

export interface ChessComSyncState {
  running: boolean;
  /** 0..1 across all games in the batch. */
  progress: number;
  gamesScanned: number;
  mistakesFound: number;
  error: string | null;
}

/**
 * Fetches chess.com games server-side, analyzes opening phases client-side
 * with Stockfish, and persists mistakes for insights + the openings hub.
 */
export function useChessComSync() {
  const [state, setState] = useState<ChessComSyncState>({
    running: false,
    progress: 0,
    gamesScanned: 0,
    mistakesFound: 0,
    error: null,
  });
  const cancelRef = useRef(false);

  const sync = useCallback(async () => {
    if (state.running) return;
    cancelRef.current = false;
    setState({
      running: true,
      progress: 0,
      gamesScanned: 0,
      mistakesFound: 0,
      error: null,
    });

    try {
      const { games } = await fetchChessComGames();
      const allMistakes: ChessComOpeningMistakeCandidateDto[] = [];

      for (let i = 0; i < games.length; i++) {
        if (cancelRef.current) break;
        const gameMistakes = await analyzeChessComGameOpening(games[i], {
          cancelled: cancelRef.current,
        });
        allMistakes.push(...gameMistakes);
        setState((s) => ({
          ...s,
          progress: (i + 1) / Math.max(games.length, 1),
          gamesScanned: i + 1,
          mistakesFound: allMistakes.length,
        }));
      }

      if (!cancelRef.current && allMistakes.length > 0) {
        await saveChessComMistakes({ mistakes: allMistakes });
      }
      await completeChessComSync(games.length);

      setState((s) => ({
        ...s,
        running: false,
        progress: 1,
        gamesScanned: games.length,
        mistakesFound: allMistakes.length,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        running: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      }));
    }
  }, [state.running]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setState((s) => ({ ...s, running: false }));
  }, []);

  return { state, sync, cancel };
}