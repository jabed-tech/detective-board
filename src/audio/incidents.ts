import type { MoodId } from '../model/types';

export type IncidentKind = 'ring' | 'talk' | 'call' | 'tv';
export interface Clip { id: string; file: string; kind: IncidentKind; moods: MoodId[] }

/** Recorded CC0 clips in public/audio/incidents/ (Freesound, credited in README). Mono 22 kHz, 5–14 s, loudness-matched. */
export const CLIPS: Clip[] = [
  { id: 'ring-rotary', file: 'ring-rotary.mp3', kind: 'ring', moods: ['noir-office', 'archive'] },
  { id: 'ring-landline', file: 'ring-landline.mp3', kind: 'ring', moods: ['precinct'] },
  { id: 'ring-w48', file: 'ring-w48.mp3', kind: 'ring', moods: ['basement', 'archive'] },
  { id: 'ring-near', file: 'ring-near.mp3', kind: 'ring', moods: ['precinct', 'motel'] },
  { id: 'chatter-typing', file: 'chatter-typing.mp3', kind: 'talk', moods: ['precinct'] },
  { id: 'chatter-office', file: 'chatter-office.mp3', kind: 'talk', moods: ['precinct'] },
  { id: 'wall-voices-a', file: 'wall-voices-a.mp3', kind: 'tv', moods: ['noir-office', 'motel'] },
  { id: 'wall-voices-b', file: 'wall-voices-b.mp3', kind: 'tv', moods: ['motel'] },
  { id: 'call-answer', file: 'call-answer.mp3', kind: 'call', moods: ['precinct', 'noir-office'] },
  { id: 'call-message', file: 'call-message.mp3', kind: 'call', moods: ['precinct'] },
];

/** Gap between incidents per mood, in ms [min, max). Very sporadic on purpose. */
export const INCIDENT_GAP: Record<MoodId, [number, number]> = {
  precinct: [60_000, 180_000],
  'noir-office': [120_000, 300_000],
  motel: [120_000, 300_000],
  basement: [240_000, 480_000],
  archive: [240_000, 480_000],
};
/** Low-pass range per mood (Hz): "through a wall"; basement/archive are further away. */
export const MUFFLE: Record<MoodId, [number, number]> = {
  precinct: [900, 1600], 'noir-office': [900, 1600], motel: [900, 1600], basement: [400, 700], archive: [500, 800],
};
export const FIRST_MIN = 30_000;

export function nextIncidentDelay(mood: MoodId, rand: () => number, first: boolean): number {
  const [lo, hi] = INCIDENT_GAP[mood];
  return first ? FIRST_MIN + Math.floor(rand() * (lo - FIRST_MIN)) : lo + Math.floor(rand() * (hi - lo));
}

export function pickClip(clips: Clip[], mood: MoodId, lastId: string | null, rand: () => number): Clip | null {
  const pool = clips.filter(c => c.moods.includes(mood));
  const choices = pool.length > 1 ? pool.filter(c => c.id !== lastId) : pool;
  return choices[Math.floor(rand() * choices.length)] ?? null;
}
