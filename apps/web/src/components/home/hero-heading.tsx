import Image from 'next/image';

/**
 * The hero's LCP heading. It deliberately carries NO entrance animation.
 *
 * `animate-rise-*` is `fadeInUp ... both`, which starts from opacity:0. Two
 * ways that hurt the largest text element on the page (S04 §5.1 / S07):
 *   1. In SSR the `both` backwards-fill paints it at opacity:0 → no valid LCP
 *      candidate at first paint.
 *   2. Applying the class only post-mount (the hero-board pattern) is worse for
 *      the LCP element: on hydration React re-runs fadeInUp from opacity:0, so
 *      Chrome records a fresh LCP entry when the headline finishes fading back
 *      in — several seconds out under throttled load.
 *
 * The logo is the LCP element (verified via PerformanceObserver), so it
 * renders statically at opacity:1 and paints at first contentful paint. Action
 * tiles and the board still carry the staggered rise. Keeping this a tiny
 * standalone component documents the constraint so a future edit doesn't re-add
 * `animate-rise-*` here.
 */
export function HeroHeading() {
  return (
    <h1 id="hero-wordmark" className="mt-8 sm:mt-10">
      <Image
        src="/logo-full.svg"
        alt="Purechess"
        width={600}
        height={140}
        priority
        className="mx-auto h-auto w-[min(100%,18rem)] sm:w-[min(100%,22rem)]"
      />
    </h1>
  );
}