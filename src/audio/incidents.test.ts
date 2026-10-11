import { describe, expect, it } from 'vitest';
import { FIRST_MIN, INCIDENT_GAP, nextIncidentDelay, pickClip, type Clip } from './incidents';
import { rng } from '../model/random';

const clips: Clip[] = [
  { id: 'ring1', file: 'ring1.mp3', kind: 'ring', moods: ['precinct', 'noir-office'] },
  { id: 'talk1', file: 'talk1.mp3', kind: 'talk', moods: ['precinct'] },
  { id: 'tv1', file: 'tv1.mp3', kind: 'tv', moods: ['motel'] },
];

describe('nextIncidentDelay', () => {
  it('stays inside the mood gap', () => {
    const r = rng(1);
    for (let i = 0; i < 200; i++) {
      const d = nextIncidentDelay('precinct', r, false);
      expect(d).toBeGreaterThanOrEqual(INCIDENT_GAP.precinct[0]);
      expect(d).toBeLessThan(INCIDENT_GAP.precinct[1]);
    }
  });
  it('first incident waits at least 30 s but no longer than the usual minimum', () => {
    const r = rng(2);
    for (let i = 0; i < 200; i++) {
      const d = nextIncidentDelay('basement', r, true);
      expect(d).toBeGreaterThanOrEqual(FIRST_MIN);
      expect(d).toBeLessThan(INCIDENT_GAP.basement[0]);
    }
  });
});

describe('pickClip', () => {
  it('only picks clips for the mood', () => {
    const r = rng(3);
    for (let i = 0; i < 50; i++) expect(pickClip(clips, 'motel', null, r)?.id).toBe('tv1');
  });
  it('never repeats the last clip when there is a choice', () => {
    const r = rng(4);
    for (let i = 0; i < 50; i++) expect(pickClip(clips, 'precinct', 'ring1', r)?.id).toBe('talk1');
  });
  it('repeats when it is the only clip for the mood', () => expect(pickClip(clips, 'motel', 'tv1', rng(5))?.id).toBe('tv1'));
  it('returns null when the mood has no clips', () => expect(pickClip(clips, 'archive', null, rng(6))).toBeNull());
  it('returns null for an empty manifest', () => expect(pickClip([], 'precinct', null, rng(7))).toBeNull());
});
