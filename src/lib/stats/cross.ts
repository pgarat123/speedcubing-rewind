import { effectiveMs } from '../timer/types';
import type { TaggedSolve } from './training';
import type { WcaCompetition, WcaResult } from '../wca/types';
import { meanOf } from './averages';

/**
 * Carte 15, maison vs compétition : pour chaque compétition de l'année, on
 * compare la moyenne officielle de l'épreuve à la moyenne maison des 30 jours
 * précédents.
 */

export const HOME_WINDOW_DAYS = 30;
/** En dessous de ce nombre de solves maison dans la fenêtre, la comparaison n'a pas de sens. */
export const MIN_HOME_SOLVES = 12;

export interface CompComparison {
  competitionId: string;
  /** Moyenne maison en ms. */
  homeMs: number;
  homeSolves: number;
  /** Moyenne des moyennes officielles de la compétition, en ms. */
  compMs: number;
  /** compMs - homeMs : positif quand on est plus lent en compétition. */
  deltaMs: number;
}

export interface HomeVsComp {
  event: string;
  comparisons: CompComparison[];
  /** Moyenne des écarts, null s'il n'y a aucune comparaison. */
  meanDeltaMs: number | null;
  homeMeanMs: number | null;
  compMeanMs: number | null;
  biggestGap: CompComparison | null;
  bestComposure: CompComparison | null;
}

export function homeVsComp(
  event: string,
  homeSolves: readonly TaggedSolve[],
  results: readonly WcaResult[],
  competitions: ReadonlyMap<string, WcaCompetition>,
  year: number,
): HomeVsComp {
  const solves = homeSolves.filter((t) => t.assignment.kind === 'event' && t.assignment.event === event).map((t) => t.solve);

  const perComp = new Map<string, number[]>();
  for (const r of results) {
    if (r.event_id !== event || r.average <= 0) continue;
    const c = competitions.get(r.competition_id);
    if (!c?.start_date.startsWith(`${year}-`)) continue;
    const list = perComp.get(r.competition_id) ?? [];
    list.push(r.average * 10);
    perComp.set(r.competition_id, list);
  }

  const comparisons: CompComparison[] = [];
  for (const [competitionId, avgs] of perComp) {
    const start = localMidnight(competitions.get(competitionId)!.start_date);
    const from = start - HOME_WINDOW_DAYS * 86_400_000;
    const window = solves.filter((s) => s.timestamp >= from && s.timestamp < start);
    const homeMs = meanOf(window.map(effectiveMs));
    if (homeMs === null || window.length < MIN_HOME_SOLVES) continue;
    const compMs = avgs.reduce((s, a) => s + a, 0) / avgs.length;
    comparisons.push({ competitionId, homeMs, homeSolves: window.length, compMs, deltaMs: compMs - homeMs });
  }
  comparisons.sort((a, b) => competitions.get(a.competitionId)!.start_date.localeCompare(competitions.get(b.competitionId)!.start_date));

  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const byDelta = [...comparisons].sort((a, b) => b.deltaMs - a.deltaMs);
  return {
    event,
    comparisons,
    meanDeltaMs: avg(comparisons.map((c) => c.deltaMs)),
    homeMeanMs: avg(comparisons.map((c) => c.homeMs)),
    compMeanMs: avg(comparisons.map((c) => c.compMs)),
    biggestGap: byDelta[0] ?? null,
    bestComposure: byDelta.length > 1 ? byDelta[byDelta.length - 1]! : null,
  };
}

/** Minuit local du jour donné (YYYY-MM-DD). */
function localMidnight(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!).getTime();
}
