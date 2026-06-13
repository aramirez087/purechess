/**
 * Client for the opening-repertoire API (`/repertoire`). Every call is
 * auth-gated, so all carry the session cookie (`credentials: 'include'`).
 *
 * Parse-side: this app parses pasted PGN into the `AnalysisNode` tree itself
 * (via `lib/board/pgn-parser`) and posts the pre-built `tree` — the server
 * re-validates structure + chess legality and caps node count. The shapes are
 * the real `@purechess/shared` DTOs.
 */
import type {
  CreateRepertoireDto,
  DrillLinesDto,
  GradeDrillDto,
  GradeDrillResultDto,
  ImportRepertoireDto,
  RepertoireDto,
  RepertoireSummaryDto,
  UpdateRepertoireDto,
} from '@purechess/shared';

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000');

async function ensureOk(res: Response, what: string): Promise<Response> {
  if (!res.ok) {
    let message = `${what} failed: ${res.status}`;
    try {
      const body = (await res.clone().json()) as { message?: string | string[] };
      if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      }
    } catch {
      // non-JSON body — keep the status message
    }
    throw Object.assign(new Error(message), { status: res.status });
  }
  return res;
}

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

/** The user's repertoires (summaries — no tree payload), newest first. */
export async function listRepertoires(): Promise<RepertoireSummaryDto[]> {
  const res = await fetch(`${API}/api/repertoire`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'repertoire list');
  return res.json() as Promise<RepertoireSummaryDto[]>;
}

/** One repertoire with its full move tree. */
export async function getRepertoire(id: string): Promise<RepertoireDto> {
  const res = await fetch(`${API}/api/repertoire/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'repertoire fetch');
  return res.json() as Promise<RepertoireDto>;
}

/** Creates a repertoire from a pre-built tree. */
export async function createRepertoire(body: CreateRepertoireDto): Promise<RepertoireDto> {
  const res = await fetch(`${API}/api/repertoire`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  await ensureOk(res, 'repertoire create');
  return res.json() as Promise<RepertoireDto>;
}

/** Imports a repertoire from a pre-parsed tree (preferred) or raw PGN. */
export async function importRepertoire(body: ImportRepertoireDto): Promise<RepertoireDto> {
  const res = await fetch(`${API}/api/repertoire/import`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  await ensureOk(res, 'repertoire import');
  return res.json() as Promise<RepertoireDto>;
}

/** Partial update (name/color/tree). */
export async function updateRepertoire(
  id: string,
  body: UpdateRepertoireDto,
): Promise<RepertoireDto> {
  const res = await fetch(`${API}/api/repertoire/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  await ensureOk(res, 'repertoire update');
  return res.json() as Promise<RepertoireDto>;
}

/** Deletes a repertoire. */
export async function deleteRepertoire(id: string): Promise<{ id: string }> {
  const res = await fetch(`${API}/api/repertoire/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'repertoire delete');
  return res.json() as Promise<{ id: string }>;
}

/**
 * The lines to drill this session for a repertoire (due leaves first, then a
 * few never-trained lines). The board plays the opponent's replies; the user
 * supplies the booked moves for their color.
 */
export async function fetchDrillLines(id: string): Promise<DrillLinesDto> {
  const res = await fetch(`${API}/api/repertoire/${encodeURIComponent(id)}/drill`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'drill lines');
  return res.json() as Promise<DrillLinesDto>;
}

/** Grade a drilled line — reschedules it via the shared spaced-repetition queue. */
export async function gradeDrill(
  id: string,
  body: GradeDrillDto,
): Promise<GradeDrillResultDto> {
  const res = await fetch(`${API}/api/repertoire/${encodeURIComponent(id)}/grade`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  await ensureOk(res, 'drill grade');
  return res.json() as Promise<GradeDrillResultDto>;
}
