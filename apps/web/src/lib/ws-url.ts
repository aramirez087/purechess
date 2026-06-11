// WS cannot ride the Next /api rewrite proxy (rewrites don't upgrade), so the
// browser talks to the API origin directly. CORS + SameSite=None cookies are
// already configured for cross-site fly.dev in production.
export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://purechess-api.fly.dev'
    : 'http://localhost:4000');
