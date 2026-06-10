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
import { login } from '@/lib/api/auth';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') ?? '/play';

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
            className="font-medium text-brass underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <Card className="border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="space-y-2">
              <Label
                htmlFor="emailOrUsername"
                className="text-xs uppercase tracking-[0.14em] text-muted-foreground"
              >
                Email or username
              </Label>
              <Input
                id="emailOrUsername"
                autoComplete="username"
                required
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs uppercase tracking-[0.14em] text-muted-foreground"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={pending || !emailOrUsername || !password}
              className="mt-1 h-11 w-full bg-foreground text-background shadow-elevated hover:bg-foreground/90"
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
