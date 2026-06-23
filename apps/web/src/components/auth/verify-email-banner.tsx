'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMe, resendVerificationEmail } from '@/lib/api/auth';

export function VerifyEmailBanner() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    staleTime: 30_000,
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const user = data?.user;
  if (!user || user.emailVerified) return null;

  async function handleResend() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await resendVerificationEmail();
      setMessage('Verification email sent. Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send email.');
    } finally {
      setPending(false);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    }
  }

  return (
    <div
      role="status"
      className="mb-6 rounded-lg border border-brass/30 bg-brass/10 px-4 py-3 text-sm text-foreground"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brass-text" aria-hidden="true" />
          <p>
            Verify your email to join rated Quick Match games. We sent a link when you signed up.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={handleResend}
          className="shrink-0 border-brass/40"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            'Resend email'
          )}
        </Button>
      </div>
      {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
      {error && (
        <p className="mt-2 text-xs text-destructive dark:text-[hsl(0_72%_70%)]">{error}</p>
      )}
    </div>
  );
}