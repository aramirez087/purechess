'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';
import { requestPasswordReset } from '@/lib/api/auth';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter the email on your account.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not send reset email. Try again.',
      );
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Reset password."
      subtitle="We'll email you a link to choose a new one."
      footer={
        <>
          Remembered it?{' '}
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
          {sent ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                If an account exists for <span className="text-foreground">{email}</span>,
                we sent a reset link. Check your inbox and spam folder.
              </p>
              <p>The link expires in one hour.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="animate-error-in rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:text-[hsl(0_72%_70%)]"
                >
                  {error}
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
                  <Mail className="h-4 w-4" aria-hidden="true" />
                )}
                {pending ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}