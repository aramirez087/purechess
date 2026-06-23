'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';
import { confirmPasswordReset } from '@/lib/api/auth';

const PASSWORD_PATTERN = /(?=.*[A-Z])(?=.*[0-9])/;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function localValidation(): string | null {
    if (!token) return 'This reset link is invalid. Request a new one.';
    if (password.length < 8 || !PASSWORD_PATTERN.test(password)) {
      return 'Password must be at least 8 characters with one uppercase letter and one number.';
    }
    if (password !== confirm) return 'Passwords do not match.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = localValidation();
    if (validation) {
      setError(validation);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await confirmPasswordReset(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not reset password. Try again.',
      );
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Choose a new password."
      subtitle="You'll need to sign in again on your other devices."
      footer={
        <>
          Back to{' '}
          <Link
            href="/login"
            className="font-medium text-brass-text underline decoration-brass-text/30 underline-offset-4 transition-colors hover:text-brass-text/80 hover:decoration-brass-text"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Card className="relative overflow-hidden border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-brass/40 before:to-transparent">
        <CardContent className="pt-6">
          {done ? (
            <p className="text-sm text-muted-foreground">
              Password updated. Redirecting you to sign in…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                >
                  New password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  At least 8 characters, one uppercase letter, one number.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="confirm"
                  className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Confirm password
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="animate-error-in rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:text-[hsl(0_72%_70%)]"
                >
                  {error}
                  {!token && (
                    <>
                      {' '}
                      <Link href="/forgot-password" className="underline">
                        Request a new link
                      </Link>
                    </>
                  )}
                </p>
              )}

              <Button
                type="submit"
                disabled={pending}
                className="mt-1 h-11 w-full bg-brass font-semibold text-accent-foreground shadow-elevated transition-all duration-150 hover:bg-brass/90 hover:shadow-brass-glow active:translate-y-px disabled:opacity-70"
              >
                {pending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                )}
                {pending ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}