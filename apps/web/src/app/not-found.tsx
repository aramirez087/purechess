import Link from 'next/link';
import { ErrorState } from '@/components/error-state';

export default function NotFound() {
  return (
    <ErrorState
      eyebrow="404"
      headline="Lost position."
      description="The page you're looking for doesn't exist."
      actions={
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Back to home
        </Link>
      }
    />
  );
}
