import type {
  GradeDrillResultDto,
  GradeLabDrillDto,
  LabDrillLinesDto,
  RepertoireColorDto,
} from '@purechess/shared';
import { API_BASE as API, ensureOk } from './client';

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' };

export async function fetchLabDrillLines(
  family: string,
  color: RepertoireColorDto = 'white',
): Promise<LabDrillLinesDto> {
  const params = new URLSearchParams({ family, color });
  const res = await fetch(`${API}/api/opening-lab/drill?${params}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  await ensureOk(res, 'lab drill');
  return res.json() as Promise<LabDrillLinesDto>;
}

export async function gradeLabDrill(body: GradeLabDrillDto): Promise<GradeDrillResultDto> {
  const res = await fetch(`${API}/api/opening-lab/grade`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  await ensureOk(res, 'lab drill grade');
  return res.json() as Promise<GradeDrillResultDto>;
}