import { describe, expect, it } from 'vitest';
import { computeSeason, findPrs, haversineKm, sortResults } from '../src/lib/wca/season';
import { homeVsComp } from '../src/lib/stats/cross';
import type { WcaCompetition, WcaResult } from '../src/lib/wca/types';
import type { TaggedSolve } from '../src/lib/stats/training';

const comp = (id: string, start: string, city: string, country: string, lat: number, lon: number, end = start): WcaCompetition => ({
  id, name: id, city, country_iso2: country, start_date: start, end_date: end, latitude_degrees: lat, longitude_degrees: lon, event_ids: ['333'],
});
let rid = 0;
const res = (competition_id: string, event_id: string, round_type_id: string, best: number, average: number, extra: Partial<WcaResult> = {}): WcaResult => ({
  id: ++rid, competition_id, event_id, round_type_id, pos: 10, best, average, attempts: [best, best, best, best, best], regional_single_record: null, regional_average_record: null, ...extra,
});

const comps = new Map([
  ['Old2025', comp('Old2025', '2025-10-04', 'Lyon', 'FR', 45.76, 4.84)],
  ['Paris2026', comp('Paris2026', '2026-03-14', 'Paris', 'FR', 48.86, 2.35, '2026-03-15')],
  ['Brussels2026', comp('Brussels2026', '2026-07-18', 'Bruxelles', 'BE', 50.85, 4.35)],
]);

const results = [
  // Ordre volontairement mélangé : le tri doit suivre date puis tour.
  res('Brussels2026', '333', 'f', 1250, 1420, { pos: 2 }),
  res('Paris2026', '333', '1', 1300, 1480),
  res('Old2025', '333', '1', 1400, 1550),
  res('Paris2026', '333', 'f', 1350, 1450, { attempts: [1350, -1, 1400, 1500, -2] }),
  res('Paris2026', '222', '1', 400, 520),
];

describe('saison WCA', () => {
  it('trie par date de compétition puis par tour', () => {
    expect(sortResults(results, comps).map((r) => `${r.competition_id}:${r.round_type_id}:${r.event_id}`)).toEqual([
      'Old2025:1:333', 'Paris2026:1:333', 'Paris2026:1:222', 'Paris2026:f:333', 'Brussels2026:f:333',
    ]);
  });

  it('rejoue l\'historique pour trouver chaque PR battu', () => {
    const prs = findPrs(sortResults(results, comps));
    expect(prs.map((p) => `${p.competitionId}:${p.event}:${p.kind}:${p.previous}→${p.value}`)).toEqual([
      'Old2025:333:single:null→1400', 'Old2025:333:average:null→1550',
      'Paris2026:333:single:1400→1300', 'Paris2026:333:average:1550→1480',
      'Paris2026:222:single:null→400', 'Paris2026:222:average:null→520',
      'Paris2026:333:average:1480→1450',
      'Brussels2026:333:single:1300→1250', 'Brussels2026:333:average:1450→1420',
    ]);
  });

  it('résume l\'année', () => {
    const s = computeSeason(results, comps, 2026);
    expect(s.competitions.map((c) => c.competition.id)).toEqual(['Paris2026', 'Brussels2026']);
    expect(s.competitionDays).toBe(3);
    expect(s.cities).toEqual(['Paris', 'Bruxelles']);
    expect(s.countries).toEqual(['FR', 'BE']);
    expect(s.travelKm).toBe(Math.round(haversineKm({ lat: 48.86, lon: 2.35 }, { lat: 50.85, lon: 4.35 })));
    expect(s.prs).toHaveLength(7);
    // 333 : 5 + 4 (la finale de Paris a 1 DNF et 1 DNS, qui ne compte pas) + 5 essais ; 222 : 5.
    expect(s.events[0]).toEqual({ event: '333', attempts: 14, dnf: 1 });
    expect(s.officialSolves).toBe(19);
    expect(s.highlight).toMatchObject({ type: 'podium', competitionId: 'Brussels2026', pos: 2 });
  });

  it('compte les allers-retours depuis la ville de l\'utilisateur', () => {
    const lyon = { lat: 45.76, lon: 4.84 };
    const s = computeSeason(results, comps, 2026, lyon);
    const expected = 2 * haversineKm(lyon, { lat: 48.86, lon: 2.35 }) + 2 * haversineKm(lyon, { lat: 50.85, lon: 4.35 });
    expect(s.travelKm).toBe(Math.round(expected));
    expect(s.travelFromHome).toBe(true);
  });

  it('met un record régional au-dessus d\'un podium', () => {
    const withNr = [...results, res('Brussels2026', '222', '1', 300, 380, { regional_single_record: 'NR' })];
    expect(computeSeason(withNr, comps, 2026).highlight).toMatchObject({ type: 'record', record: 'NR', event: '222' });
  });

  it('calcule une distance réaliste', () => {
    expect(haversineKm({ lat: 48.86, lon: 2.35 }, { lat: 45.76, lon: 4.84 })).toBeGreaterThan(385);
    expect(haversineKm({ lat: 48.86, lon: 2.35 }, { lat: 45.76, lon: 4.84 })).toBeLessThan(400);
  });
});

describe('maison vs compétition', () => {
  const session = { id: '1', name: 'Main', scrambleType: '333', rank: 1, solves: [] };
  const assignment = { sessionId: '1', kind: 'event' as const, event: '333' as const };
  const home = (date: string, ms: number, n: number): TaggedSolve[] =>
    Array.from({ length: n }, (_, i) => ({ session, assignment, solve: { rawMs: ms, penalty: 'none' as const, timestamp: new Date(`${date}T21:00:00`).getTime() + i * 30_000 } }));

  it('compare la moyenne officielle aux 30 jours précédents', () => {
    const solves = [...home('2026-03-01', 13000, 20), ...home('2026-07-10', 13500, 20), ...home('2026-07-19', 9000, 50)];
    const r = homeVsComp('333', solves, results, comps, 2026);
    expect(r.comparisons.map((c) => c.competitionId)).toEqual(['Paris2026', 'Brussels2026']);
    expect(r.comparisons[0]!.homeMs).toBe(13000);
    expect(r.comparisons[0]!.compMs).toBe((14800 + 14500) / 2);
    expect(r.comparisons[1]!.deltaMs).toBe(14200 - 13500);
    expect(r.biggestGap?.competitionId).toBe('Paris2026');
    expect(r.bestComposure?.competitionId).toBe('Brussels2026');
  });

  it('ignore une compétition sans assez de solves maison avant', () => {
    const r = homeVsComp('333', home('2026-03-01', 13000, 5), results, comps, 2026);
    expect(r.comparisons).toHaveLength(0);
    expect(r.meanDeltaMs).toBeNull();
  });
});
