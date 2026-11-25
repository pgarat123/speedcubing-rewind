import type { WcaCompetition, WcaResult } from './types';

/**
 * Saison WCA d'un compétiteur : compétitions, voyages, épreuves, PR battus,
 * moment fort. Les résultats WCA n'ont pas de date : on prend celle de la
 * compétition, puis l'ordre des tours.
 */

/** Ordre des tours dans une compétition (round_type_id WCA). */
const ROUND_ORDER: Record<string, number> = {
  '0': 0, h: 0, '1': 1, d: 1, '2': 2, e: 2, '3': 3, g: 3, b: 4, c: 5, f: 5,
};
const FINAL_ROUNDS = new Set(['c', 'f']);

export interface LatLon {
  lat: number;
  lon: number;
}

export type RecordKind = 'single' | 'average';

export interface PrBroken {
  event: string;
  kind: RecordKind;
  competitionId: string;
  roundTypeId: string;
  /** Ancien PR, null si c'était le premier résultat dans l'épreuve. */
  previous: number | null;
  value: number;
}

export type HighlightType = 'record' | 'podium' | 'final' | 'pr';

export interface Highlight {
  type: HighlightType;
  event: string;
  competitionId: string;
  /** Position au classement pour podium et finale. */
  pos?: number;
  /** Code du record (WR, ER, NR...) pour un record. */
  record?: string;
  pr?: PrBroken;
}

export interface EventSeason {
  event: string;
  /** Essais officiels réalisés (DNF compris, DNS exclus). */
  attempts: number;
  dnf: number;
}

export interface CompetitionVisit {
  competition: WcaCompetition;
  days: number;
}

export interface Season {
  year: number;
  competitions: CompetitionVisit[];
  competitionDays: number;
  cities: string[];
  countries: string[];
  travelKm: number;
  /** true si les km sont comptés depuis la ville de l'utilisateur (allers-retours). */
  travelFromHome: boolean;
  events: EventSeason[];
  officialSolves: number;
  prs: PrBroken[];
  highlight: Highlight | null;
}

export function computeSeason(
  results: readonly WcaResult[],
  competitions: ReadonlyMap<string, WcaCompetition>,
  year: number,
  home?: LatLon,
): Season {
  const sorted = sortResults(results, competitions);
  const inYear = (r: WcaResult) => competitions.get(r.competition_id)?.start_date.startsWith(`${year}-`) ?? false;
  const yearResults = sorted.filter(inYear);

  const compIds = [...new Set(yearResults.map((r) => r.competition_id))];
  const visits: CompetitionVisit[] = compIds.map((id) => {
    const c = competitions.get(id)!;
    return { competition: c, days: daysBetween(c.start_date, c.end_date) + 1 };
  });

  const events = new Map<string, EventSeason>();
  for (const r of yearResults) {
    const e = events.get(r.event_id) ?? { event: r.event_id, attempts: 0, dnf: 0 };
    for (const a of r.attempts) {
      if (a === 0 || a === -2) continue;
      e.attempts++;
      if (a === -1) e.dnf++;
    }
    events.set(r.event_id, e);
  }
  const eventList = [...events.values()].sort((a, b) => b.attempts - a.attempts);

  const prs = findPrs(sorted).filter((p) => {
    const c = competitions.get(p.competitionId);
    return c?.start_date.startsWith(`${year}-`) ?? false;
  });

  const comps = visits.map((v) => v.competition);
  return {
    year,
    competitions: visits,
    competitionDays: visits.reduce((s, v) => s + v.days, 0),
    cities: [...new Set(comps.map((c) => `${c.city}|${c.country_iso2}`))].map((k) => k.split('|')[0]!),
    countries: [...new Set(comps.map((c) => c.country_iso2))],
    travelKm: Math.round(travelDistance(comps, home)),
    travelFromHome: Boolean(home),
    events: eventList,
    officialSolves: eventList.reduce((s, e) => s + e.attempts, 0),
    prs,
    highlight: pickHighlight(yearResults, prs),
  };
}

export function sortResults(results: readonly WcaResult[], competitions: ReadonlyMap<string, WcaCompetition>): WcaResult[] {
  return [...results].sort((a, b) => {
    const ca = competitions.get(a.competition_id);
    const cb = competitions.get(b.competition_id);
    const d =
      (ca?.start_date ?? '').localeCompare(cb?.start_date ?? '') ||
      (ca?.end_date ?? '').localeCompare(cb?.end_date ?? '') ||
      a.competition_id.localeCompare(b.competition_id);
    return d || (ROUND_ORDER[a.round_type_id] ?? 1) - (ROUND_ORDER[b.round_type_id] ?? 1);
  });
}

/** Rejoue l'historique trié et liste chaque amélioration de PR (single et moyenne). */
export function findPrs(sorted: readonly WcaResult[]): PrBroken[] {
  const best = new Map<string, number>();
  const out: PrBroken[] = [];
  for (const r of sorted) {
    for (const kind of ['single', 'average'] as const) {
      const value = kind === 'single' ? r.best : r.average;
      if (value <= 0) continue;
      const key = `${r.event_id}:${kind}`;
      const prev = best.get(key);
      if (prev === undefined || value < prev) {
        out.push({ event: r.event_id, kind, competitionId: r.competition_id, roundTypeId: r.round_type_id, previous: prev ?? null, value });
        best.set(key, value);
      }
    }
  }
  return out;
}

/** Hiérarchie du moment fort : record > podium > finale > plus gros PR (en %). */
export function pickHighlight(yearResults: readonly WcaResult[], prs: readonly PrBroken[]): Highlight | null {
  const rec = yearResults.find((r) => r.regional_single_record || r.regional_average_record);
  if (rec) {
    return { type: 'record', event: rec.event_id, competitionId: rec.competition_id, record: (rec.regional_single_record ?? rec.regional_average_record)! };
  }
  const finals = yearResults.filter((r) => FINAL_ROUNDS.has(r.round_type_id) && r.best > 0);
  const podium = finals.filter((r) => r.pos <= 3).sort((a, b) => a.pos - b.pos)[0];
  if (podium) return { type: 'podium', event: podium.event_id, competitionId: podium.competition_id, pos: podium.pos };
  const final = [...finals].sort((a, b) => a.pos - b.pos)[0];
  if (final) return { type: 'final', event: final.event_id, competitionId: final.competition_id, pos: final.pos };
  const improved = prs.filter((p) => p.previous !== null);
  const pr = [...improved].sort((a, b) => gain(b) - gain(a))[0] ?? prs[0];
  return pr ? { type: 'pr', event: pr.event, competitionId: pr.competitionId, pr } : null;
}

function gain(p: PrBroken): number {
  return p.previous ? (p.previous - p.value) / p.previous : 0;
}

export function travelDistance(sortedComps: readonly WcaCompetition[], home?: LatLon): number {
  const pts = sortedComps.map((c) => ({ lat: c.latitude_degrees, lon: c.longitude_degrees }));
  if (home) return pts.reduce((s, p) => s + 2 * haversineKm(home, p), 0);
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += haversineKm(pts[i - 1]!, pts[i]!);
  return total;
}

export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}
