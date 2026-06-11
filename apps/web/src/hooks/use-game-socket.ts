'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  WsEvent,
  type WsGamePresencePayload,
  type WsGameStatePayload,
} from '@purechess/shared';

import { WS_URL } from '@/lib/ws-url';

export interface GameSocketState {
  /** Live push channel up — polling can relax to a slow heartbeat. */
  connected: boolean;
  /** User ids in the game room, null until the first presence broadcast. */
  presentUserIds: string[] | null;
  /** serverNow - clientNow from the latest push; corrects clock-drain skew. */
  clockOffsetMs: number;
}

interface GameSocketHandlers {
  /** Server pushed authoritative state (move, resign, flag fall). */
  onState: (payload: WsGameStatePayload) => void;
  /** Connection was re-established — caller should refetch over REST. */
  onResync: () => void;
}

/**
 * Joins the game's Socket.IO room and surfaces server pushes. Authentication
 * rides the session cookie on the handshake. The socket is a low-latency
 * layer only — REST stays the source of truth (initial load, move submission,
 * reconnect resync), so a dead socket degrades to polling, never breaks play.
 */
export function useGameSocket(
  gameId: string,
  enabled: boolean,
  handlers: GameSocketHandlers,
): GameSocketState {
  const [connected, setConnected] = useState(false);
  const [presentUserIds, setPresentUserIds] = useState<string[] | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let hadConnected = false;
    let lastResyncAt = 0;
    const socket: Socket = io(WS_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      // Bounded exponential backoff with jitter. Never give up on a live game,
      // but lower the warm-reconnect floor to help the < 2s resync budget and
      // keep jitter so a server restart doesn't get a synchronized reconnect
      // storm across every client.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
      randomizationFactor: 0.5,
      timeout: 10_000,
    });

    // Tab sleep / laptop suspend freezes timers and can leave a half-open
    // socket WITHOUT a `disconnect` — so the connect-driven resync never fires
    // and the board sits stale until the next server push. The `online` and
    // `visibilitychange`->visible events catch that wake. Resync routes through
    // the SAME guarded path as reconnect (`onResync` -> REST refetch ->
    // isStaleState merge); it never adds a second merge path, so no rewind.
    const resync = () => {
      if (disposed) return;
      // online + visibilitychange both fire on wake — throttle to one REST GET.
      const now = Date.now();
      if (now - lastResyncAt < 250) return;
      lastResyncAt = now;
      if (!socket.connected) socket.connect(); // nudge a half-open socket
      socket.emit(WsEvent.GameJoin, { gameId }); // idempotent: already-joined → no-op
      handlersRef.current.onResync();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') resync();
    };
    window.addEventListener('online', resync);
    document.addEventListener('visibilitychange', onVisible);

    socket.on('connect', () => {
      if (disposed) return;
      setConnected(true);
      socket.emit(WsEvent.GameJoin, { gameId });
      if (hadConnected) handlersRef.current.onResync();
      hadConnected = true;
    });

    socket.on('disconnect', () => {
      if (disposed) return;
      setConnected(false);
      setPresentUserIds(null);
    });

    socket.on(WsEvent.GameState, (payload: WsGameStatePayload) => {
      if (disposed || payload.gameId !== gameId) return;
      setClockOffsetMs(payload.serverNow - Date.now());
      handlersRef.current.onState(payload);
    });

    socket.on(WsEvent.GamePresence, (payload: WsGamePresencePayload) => {
      if (disposed || payload.gameId !== gameId) return;
      setPresentUserIds(payload.userIds);
    });

    return () => {
      disposed = true;
      window.removeEventListener('online', resync);
      document.removeEventListener('visibilitychange', onVisible);
      socket.disconnect();
      setConnected(false);
      setPresentUserIds(null);
    };
  }, [gameId, enabled]);

  return { connected, presentUserIds, clockOffsetMs };
}
