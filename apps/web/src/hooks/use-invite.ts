'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

const API_URL = // Production browsers call same-origin '' (the Next /api proxy);
// dev talks to the API directly.
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

export type InviteColor = 'white' | 'black' | 'random';
export type TimeControlCategory = 'bullet' | 'blitz' | 'rapid';

export interface CreateInviteParams {
  timeControlSeconds: number;
  incrementSeconds: number;
  category: TimeControlCategory;
  color?: InviteColor;
  /** Rated games feed Glicko-2 on completion. Omitted = casual. */
  rated?: boolean;
}

export interface InvitePreview {
  gameId: string;
  timeControlSeconds: number;
  incrementSeconds: number;
  category: TimeControlCategory;
  creator: { id: string; username: string; avatarUrl: string | null } | null;
  creatorColor: 'white' | 'black';
  /** Creator's original pick — 'random' means colors are decided at accept. Absent on legacy invites. */
  colorChoice?: InviteColor;
  rated?: boolean;
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
    mutationFn: ({
      timeControlSeconds,
      incrementSeconds,
      category,
      color,
      rated,
    }: CreateInviteParams) => {
      const colorParam = color ?? 'random';
      return apiFetch<CreateInviteResult>(`/invites?color=${colorParam}`, {
        method: 'POST',
        body: JSON.stringify({
          timeControlSeconds,
          incrementSeconds,
          category,
          ...(rated !== undefined ? { rated } : {}),
        }),
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

