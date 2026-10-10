import { MOODS, type Atmosphere, type EffectId, type MoodId } from '../model/types';

export function activeEffects(mood: MoodId, atmosphere: Atmosphere, reducedMotion: boolean,
  toggles: Record<EffectId, boolean>): { id: EffectId; animated: boolean }[] {
  const still = reducedMotion || atmosphere === 'off';
  const out: { id: EffectId; animated: boolean }[] = [];
  for (const id of MOODS[mood].effects) {
    if (toggles[id] === false) continue;
    if (id === 'flicker' || id === 'rain' || id === 'dust') {
      if (!still) out.push({ id, animated: true });
    } else if (id === 'blinds') out.push({ id, animated: !still && atmosphere === 'full' });
    else out.push({ id, animated: !still });
  }
  return out;
}
