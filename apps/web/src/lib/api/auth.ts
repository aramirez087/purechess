import type { SafeUser } from '@purechess/shared';
import { apiFetch } from './client';

export interface AuthResponse {
  user: SafeUser;
}

export function register(dto: {
  email: string;
  username: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(dto) });
}

export function login(dto: {
  emailOrUsername: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(dto) });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiFetch('/auth/logout', { method: 'POST' });
}

/** 200 {user: null} when unauthenticated — never a 401. */
export function getMe(): Promise<{ user: SafeUser | null }> {
  return apiFetch('/auth/me');
}

export function requestPasswordReset(email: string): Promise<void> {
  return apiFetch('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  return apiFetch('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export function resendVerificationEmail(): Promise<void> {
  return apiFetch('/auth/email-verification/resend', { method: 'POST' });
}

export function confirmEmailVerification(token: string): Promise<void> {
  return apiFetch('/auth/email-verification/confirm', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}