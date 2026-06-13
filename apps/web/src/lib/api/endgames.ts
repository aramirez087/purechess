/**
 * Client for the endgame-drills API (`/endgames`).
 *
 * `list` / `get` are public (per-user pass/fail merged in when the session
 * cookie is present); `probe` proxies the cached server-side tablebase (the
 * upstream URL never leaves the API); `recordAttempt` is auth-gated. All calls
 * carry the session cookie so the optional-auth endpoints see the user.
 */
import type {
  EndgameAttemptInputDto,
  EndgameAttemptResultDto,
  EndgameDrillDto,
  EndgameProbeDto,
} from '@purechess/shared';
import { API_BASE as API, ensureOk } from './client';

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

/** Every curated drill, with the user's pass/fail when signed in. */
export async function listEndgameDrills(): Promise<EndgameDrillDto[]> {
  const res = await fetch(`${API}/api/endgames`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'endgame list');
  return res.json() as Promise<EndgameDrillDto[]>;
}

/** One drill by slug. */
export async function getEndgameDrill(slug: string): Promise<EndgameDrillDto> {
  const res = await fetch(`${API}/api/endgames/${encodeURIComponent(slug)}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'endgame fetch');
  return res.json() as Promise<EndgameDrillDto>;
}

/** Probe a position via the cached, server-side tablebase. */
export async function probeEndgame(slug: string, fen: string): Promise<EndgameProbeDto> {
  const res = await fetch(`${API}/api/endgames/${encodeURIComponent(slug)}/probe`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({ fen }),
  });
  await ensureOk(res, 'endgame probe');
  return res.json() as Promise<EndgameProbeDto>;
}

/** Record the outcome of an attempt (auth required). */
export async function recordEndgameAttempt(
  slug: string,
  body: EndgameAttemptInputDto,
): Promise<EndgameAttemptResultDto> {
  const res = await fetch(`${API}/api/endgames/${encodeURIComponent(slug)}/attempt`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  await ensureOk(res, 'endgame attempt');
  return res.json() as Promise<EndgameAttemptResultDto>;
}
