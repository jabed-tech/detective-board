import { MOODS, SURFACES, type Board, type FastenerId, type MoodId, type SurfaceId } from './types';
export function pickFastener(surface: SurfaceId, last: FastenerId): FastenerId {
  const ok = SURFACES[surface].fasteners;
  return ok.includes(last) ? last : ok[0];
}
export function moodPatch(m: MoodId): Pick<Board, 'mood' | 'surface'> {
  return { mood: m, surface: MOODS[m].surface };
}
