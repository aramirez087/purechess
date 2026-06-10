'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type InviteColor = 'white' | 'black' | 'random';
export type TimeControlCategory = 'bullet' | 'blitz' | 'rapid';

export interface CreateInviteParams {
  timeControlSeconds: number;
  incrementSeconds: number;
  category: TimeControlCategory;
  color?: InviteColor;
}

export interface InvitePreview {
  gameId: string;
  timeControlSeconds: number;
  incrementSeconds: number;
  category: TimeControlCategory;
  creator: { id: string; username: string; avatarUrl: string | null } | null;
  creatorColor: 'white' | 'black';
  status: string;
}

export interface CreateInviteResult {
  gameId: string;
  inviteToken: string;
  inviteUrl: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message ?? res.statusText), { status: res.status });
  }
  return res.json() as Promise<T>;
}

export function useCreateInvite() {
  return useMutation({
    mutationFn: ({ timeControlSeconds, incrementSeconds, category, color }: CreateInviteParams) => {
      const colorParam = color ?? 'random';
      return apiFetch<CreateInviteResult>(`/invites?color=${colorParam}`, {
        method: 'POST',
        body: JSON.stringify({ timeControlSeconds, incrementSeconds, category }),
      });
    },
  });
}

/** One-shot invite fetch — used by the creator's acceptance poll. */
export function getInvite(token: string): Promise<InvitePreview> {
  return apiFetch<InvitePreview>(`/invites/${token}`);
}

export function useGetInvite(token: string | null) {
  return useQuery({
    queryKey: ['invite', token],
    queryFn: () => apiFetch<InvitePreview>(`/invites/${token}`),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ gameId: string }>(`/invites/${token}/accept`, { method: 'POST' }),
  });
}

export function useCancelInvite() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ success: boolean }>(`/invites/${token}/cancel`, { method: 'POST' }),
  });
}

export function useInviteSocket(
  gameId: string | null,
  onAccepted: (gameId: string) => void,
) {
  const cbRef = useRef(onAccepted);
  cbRef.current = onAccepted;

  useEffect(() => {
    if (!gameId) return;

    const wsUrl = API_URL.replace(/^http/, 'ws');
    const socket = new WebSocket(wsUrl);

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.event === 'invite:accepted' && data.data?.gameId) {
          cbRef.current(data.data.gameId as string);
        }
      } catch {
        // ignore malformed messages
      }
    };

    socket.addEventListener('message', handler);
    return () => {
      socket.removeEventListener('message', handler);
      socket.close();
    };
  }, [gameId]);
}
