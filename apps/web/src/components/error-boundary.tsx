'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  eventId: string | null;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, eventId: null, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      eventId: null,
      errorMessage: error.message,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
    this.setState({ eventId: eventId ?? null });
  }

  handleCopy = (): void => {
    const text = this.state.eventId ?? this.state.errorMessage;
    navigator.clipboard.writeText(text).catch(() => undefined);
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <ErrorState
        headline="Something broke."
        description="This section failed to render. Refresh to try again."
        eventId={this.state.eventId}
        className="min-h-[240px] bg-transparent"
        actions={
          <>
            <Button
              size="sm"
              onClick={() => window.location.reload()}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={this.handleCopy}>
              Copy error details
            </Button>
          </>
        }
      />
    );
  }
}
