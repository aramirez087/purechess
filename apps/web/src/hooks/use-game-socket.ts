'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  WsEvent,
  type WsGamePresencePayload,
  type WsGameStatePayload,
} from '@purechess/shared';

// WS cannot ride the Next /api rewrite proxy (rewrites don't upgrade), so the
// browser talks to the API origin directly. CORS + SameSite=None cookies are
// already configured for cross-site fly.dev in production.
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://purechess-api.fly.dev'
    : 'http://localhost:4000');

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
    const socket: Socket = io(WS_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

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
      socket.disconnect();
      setConnected(false);
      setPresentUserIds(null);
    };
  }, [gameId, enabled]);

  return { connected, presentUserIds, clockOffsetMs };
}
