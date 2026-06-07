import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CtaButton } from './cta-button';

export function Hero() {
  return (
    <section
      aria-labelledby="hero-wordmark"
      className="animate-fade-in flex flex-col items-center text-center px-6 pt-20 pb-12 sm:pt-32 sm:pb-16"
    >
      <h1
        id="hero-wordmark"
        className="font-sans text-5xl sm:text-7xl font-bold tracking-tight"
      >
        Purchess
      </h1>
      <p className="mt-4 text-xl sm:text-2xl text-muted-foreground">
        Pure chess. Nothing else.
      </p>
      <div className="mt-10 flex flex-col sm:flex-row gap-3 w-full max-w-sm sm:max-w-none sm:w-auto items-center">
        <CtaButton variant="primary" href="/play?mode=casual">
          Play now
        </CtaButton>
        <CtaButton variant="secondary" href="/register">
          Create account
        </CtaButton>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex">
                <CtaButton variant="tertiary" disabled>
                  Analyze a game
                </CtaButton>
              </span>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </section>
  );
}
