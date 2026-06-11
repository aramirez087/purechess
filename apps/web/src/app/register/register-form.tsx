'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';
import { register } from '@/lib/api/auth';

const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,18}[a-zA-Z0-9]$/;
const PASSWORD_PATTERN = /(?=.*[A-Z])(?=.*[0-9])/;

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return') ?? '/play';

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function localValidation(): string | null {
    if (!USERNAME_PATTERN.test(username)) {
      return 'Username must be 3–20 characters: letters, numbers, _ or -, starting and ending with a letter or number.';
    }
    if (password.length < 8 || !PASSWORD_PATTERN.test(password)) {
      return 'Password must be at least 8 characters with one uppercase letter and one number.';
    }
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
      await register({ email, username, password });
      router.push(returnTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Take a seat."
      subtitle="One account. Your games, your ratings, nothing else."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href={`/login?return=${encodeURIComponent(returnTo)}`}
            className="font-medium text-brass underline decoration-brass/30 underline-offset-4 transition-colors hover:text-brass/90 hover:decoration-brass"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Card className="relative overflow-hidden border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-brass/40 before:to-transparent">
        <CardContent className="pt-6">
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
            <div className="space-y-1.5">
              <Label
                htmlFor="username"
                className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
              >
                Username
              </Label>
              <Input
                id="username"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                3–20 characters. Letters, numbers, _ or -.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                At least 8 characters, one uppercase letter, one number.
              </p>
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
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              )}
              {pending ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
