'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  WsEvent,
  type MatchmakingJoinRequestDto,
  type WsMatchFoundPayload,
} from '@purechess/shared';
import { WS_URL } from '@/lib/ws-url';
import { getMatchmakingStatus, joinMatchmaking, leaveMatchmaking } from '@/lib/api/matchmaking';

const STATUS_POLL_MS = 2000;
/** Self-heal budget: silent re-joins after a TTL drop / lost claim. */
const MAX_REJOINS = 5;

export type MatchmakingState =
  | { phase: 'idle' }
  | { phase: 'searching'; elapsedSeconds: number }
  | { phase: 'matched'; gameId: string }
  | { phase: 'error'; message: string; unauthenticated: boolean };

export interface UseMatchmaking {
  state: MatchmakingState;
  join: (params: MatchmakingJoinRequestDto) => Promise<void>;
  cancel: () => Promise<void>;
}

/**
 * Quick-match queue client. REST owns intent (join/leave) and doubles as the
 * heartbeat: the 2s status poll refreshes the server-side queue TTL, recovers
 * a missed push from the match mailbox, and triggers the server's
 * rating-window widening. The socket is the low-latency layer — a
 * `match:found` push lands the moment the opponent joins.
 */
export function useMatchmaking(): UseMatchmaking {
  const [state, setState] = useState<MatchmakingState>({ phase: 'idle' });
  const paramsRef = useRef<MatchmakingJoinRequestDto | null>(null);
  const rejoinsRef = useRef(0);
  const phaseRef = useRef<MatchmakingState['phase']>('idle');
  phaseRef.current = state.phase;

  const searching = state.phase === 'searching';

  const join = useCallback(async (params: MatchmakingJoinRequestDto) => {
    paramsRef.current = params;
    rejoinsRef.current = 0;
    try {
      const res = await joinMatchmaking(params);
      if (res.status === 'matched' && res.gameId) {
        setState({ phase: 'matched', gameId: res.gameId });
      } else {
        setState({ phase: 'searching', elapsedSeconds: 0 });
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      setState({
        phase: 'error',
        message: (err as Error).message,
        unauthenticated: status === 401,
      });
    }
  }, []);

  const cancel = useCallback(async () => {
    setState({ phase: 'idle' });
    await leaveMatchmaking().catch(() => null);
  }, []);

  // Socket push: `match:found` lands instantly when the opponent's join
  // claims us out of the queue.
  useEffect(() => {
    if (!searching) return;
    const socket: Socket = io(WS_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socket.on(WsEvent.MatchFound, (payload: WsMatchFoundPayload) => {
      if (payload?.gameId) {
        setState({ phase: 'matched', gameId: payload.gameId });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [searching]);

  // Status poll: heartbeat (TTL refresh), widening trigger, missed-push
  // recovery, and self-healing re-join if our entry vanished (TTL expiry or
  // a claim whose game creation failed).
  useEffect(() => {
    if (!searching) return;
    const id = setInterval(async () => {
      try {
        const status = await getMatchmakingStatus();
        if (phaseRef.current !== 'searching') return;
        if (status.status === 'matched' && status.gameId) {
          setState({ phase: 'matched', gameId: status.gameId });
        } else if (status.status === 'idle') {
          if (paramsRef.current && rejoinsRef.current < MAX_REJOINS) {
            rejoinsRef.current += 1;
            const res = await joinMatchmaking(paramsRef.current);
            if (phaseRef.current !== 'searching') return;
            if (res.status === 'matched' && res.gameId) {
              setState({ phase: 'matched', gameId: res.gameId });
            }
          } else {
            setState({
              phase: 'error',
              message: 'Lost the queue — try again',
              unauthenticated: false,
            });
          }
        }
      } catch {
        // transient — next tick retries
      }
    }, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [searching]);

  // Elapsed timer for the searching UI.
  useEffect(() => {
    if (!searching) return;
    const id = setInterval(() => {
      setState((s) =>
        s.phase === 'searching' ? { ...s, elapsedSeconds: s.elapsedSeconds + 1 } : s,
      );
    }, 1000);
    return () => clearInterval(id);
  }, [searching]);

  // Leaving the page while searching abandons the queue server-side
  // (best-effort; the 30s TTL is the backstop). A matched unmount must NOT
  // leave — that would race the navigation into the game.
  useEffect(() => {
    return () => {
      if (phaseRef.current === 'searching') {
        void leaveMatchmaking().catch(() => null);
      }
    };
  }, []);

  return { state, join, cancel };
}
