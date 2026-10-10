import { SURFACES, type FastenerId, type SurfaceId } from './types';
export function pickFastener(surface: SurfaceId, last: FastenerId): FastenerId {
  const ok = SURFACES[surface].fasteners;
  return ok.includes(last) ? last : ok[0];
}
