'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { login } from '@/lib/api/auth';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') ?? '/play';

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const oauthError = searchParams.get('error') === 'oauth_failed'
    ? 'Sign in with Google or Apple failed. Try again or use email.'
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOrUsername.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await login({ emailOrUsername, password });
      router.push(returnTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back."
      subtitle="Sign in to keep your games and ratings."
      footer={
        <>
          New to Purechess?{' '}
          <Link
            href={`/register?return=${encodeURIComponent(returnTo)}`}
            className="font-medium text-brass-text underline decoration-brass-text/30 underline-offset-4 transition-colors hover:text-brass-text/80 hover:decoration-brass-text"
          >
            Create an account
          </Link>
        </>
      }
    >
      <Card className="relative overflow-hidden border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-brass/40 before:to-transparent">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div className="space-y-1.5">
              <Label
                htmlFor="emailOrUsername"
                className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
              >
                Email or username
              </Label>
              <Input
                id="emailOrUsername"
                autoComplete="username"
                autoFocus
                required
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="password"
                  className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-muted-foreground underline decoration-muted-foreground/30 underline-offset-4 transition-colors hover:text-foreground"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {(oauthError || error) && (
              <p
                role="alert"
                className="animate-error-in rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:text-[hsl(0_72%_70%)]"
              >
                {oauthError ?? error}
              </p>
            )}

            <Button
              type="submit"
              disabled={pending}
              className="mt-1 h-11 w-full bg-brass font-semibold text-accent-foreground shadow-elevated transition-all duration-150 hover:bg-brass/90 hover:shadow-brass-glow active:translate-y-px disabled:opacity-70"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <LogIn className="h-4 w-4" aria-hidden="true" />
              )}
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
            <OAuthButtons />
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
