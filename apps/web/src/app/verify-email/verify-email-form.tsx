'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AuthShell } from '@/components/auth/auth-shell';
import { confirmEmailVerification, getMe, resendVerificationEmail } from '@/lib/api/auth';

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const queryClient = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    staleTime: 10_000,
  });

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token || confirmed) return;
    let cancelled = false;
    setPending(true);
    confirmEmailVerification(token)
      .then(async () => {
        if (cancelled) return;
        setConfirmed(true);
        await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        setTimeout(() => router.push('/play'), 2000);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Verification failed.');
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, confirmed, queryClient, router]);

  async function handleResend() {
    setPending(true);
    setError(null);
    try {
      await resendVerificationEmail();
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send email.');
    } finally {
      setPending(false);
    }
  }

  const alreadyVerified = me?.user?.emailVerified;

  return (
    <AuthShell
      title="Verify your email."
      subtitle="Rated games need a confirmed address."
      footer={
        <>
          <Link href="/play" className="font-medium text-brass-text underline underline-offset-4">
            Back to play
          </Link>
        </>
      }
    >
      <Card className="relative overflow-hidden border-border/70 bg-surface/80 shadow-elevated backdrop-blur-sm">
        <CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
          {token ? (
            pending ? (
              <p className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Confirming your email…
              </p>
            ) : confirmed || alreadyVerified ? (
              <p className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-brass-text" aria-hidden="true" />
                Email verified. Redirecting to play…
              </p>
            ) : (
              <p role="alert" className="text-destructive dark:text-[hsl(0_72%_70%)]">
                {error ?? 'This verification link is invalid or expired.'}
              </p>
            )
          ) : (
            <>
              <p className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Check your inbox for the verification link we sent when you created your account.
              </p>
              {me?.user && !me.user.emailVerified && (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={handleResend}
                  className="w-full bg-brass text-accent-foreground hover:bg-brass/90"
                >
                  {pending ? 'Sending…' : 'Resend verification email'}
                </Button>
              )}
              {resent && <p>Verification email sent.</p>}
              {error && (
                <p role="alert" className="text-destructive dark:text-[hsl(0_72%_70%)]">
                  {error}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}