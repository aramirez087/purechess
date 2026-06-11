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
 * The headline is the LCP element (verified via PerformanceObserver), so it
 * renders statically at opacity:1 and paints at first contentful paint. The
 * badge, subtitle, CTAs, and board still carry the staggered rise, so the hero
 * still animates in. Keeping this a tiny standalone component documents the
 * constraint so a future edit doesn't re-add `animate-rise-*` here.
 */
export function HeroHeading() {
  return (
    <h1
      id="hero-wordmark"
      className="mt-6 font-display text-[clamp(3rem,7.5vw,6rem)] font-medium leading-[1.04] tracking-[-0.015em]"
    >
      The board is
      <br className="hidden sm:block" />
      <span className="relative inline-block italic">
        the product.
        <span
          aria-hidden
          className="absolute -bottom-2.5 left-1/2 -z-10 h-[3px] w-3/4 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-brass to-transparent"
        />
      </span>
    </h1>
  );
}
