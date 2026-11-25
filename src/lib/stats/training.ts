import { DRILL_FLOOR_MS, EVENTS, type EventId } from '../events';
import { median, type SessionAssignment } from '../timer/classify';
import { effectiveMs, type Solve, type TimerExport, type TimerSession } from '../timer/types';
import { computeActivity, type Activity } from './activity';
import { bestAverage, bestSingle, meanOf, type Time } from './averages';

/** Deux solves espacés de moins de 5 min appartiennent à la même séance. */
export const PRACTICE_GAP_MS = 5 * 60_000;
/** Un solve plus de 10 fois plus long que la médiane de sa session est un oubli de chrono. */
const CEILING_FACTOR = 10;

export interface TimeGroup {
  /** Id d'épreuve pour les épreuves, id de session pour les drills. */
  key: string;
  label: string;
  kind: 'event' | 'drill';
  event?: EventId;
  solves: number;
  chronoMs: number;
  /** Part du temps chronométré total (0 à 1). */
  share: number;
}

export interface EventStats {
  event: EventId;
  solves: number;
  dnf: number;
  single: number | null;
  ao5: number | null;
  ao12: number | null;
  ao100: number | null;
  /** Moyenne (hors DNF) par mois, null si aucun solve ce mois-là. */
  monthlyMean: (number | null)[];
  chronoMs: number;
}

export interface TrainingStats {
  year: number;
  totalSolves: number;
  eventSolves: number;
  drillSolves: number;
  /** Solves écartés comme aberrants (trop rapides ou chrono oublié). */
  removedOutliers: number;
  chronoMs: { total: number; events: number; drills: number };
  practiceMs: number;
  groups: TimeGroup[];
  events: EventStats[];
  /** Épreuve avec le plus de temps chronométré. */
  mainEvent: EventId | null;
  favoriteDrill: TimeGroup | null;
  activity: Activity;
}

export interface TaggedSolve {
  solve: Solve;
  session: TimerSession;
  assignment: SessionAssignment;
}

export function computeTrainingStats(
  data: TimerExport,
  assignments: readonly SessionAssignment[],
  year: number,
): TrainingStats {
  const { tagged, removedOutliers } = collectSolves(
    data,
    assignments,
    (s) => new Date(s.timestamp).getFullYear() === year,
  );

  // Temps chronométré par groupe : une épreuve regroupe toutes ses sessions,
  // un drill reste rattaché à sa session.
  const groups = new Map<string, TimeGroup>();
  let eventsMs = 0;
  let drillsMs = 0;
  for (const { solve, session, assignment } of tagged) {
    const isEvent = assignment.kind === 'event';
    const key = isEvent ? `event:${assignment.event}` : `drill:${session.id}`;
    let g = groups.get(key);
    if (!g) {
      g = isEvent
        ? { key: assignment.event!, label: EVENTS[assignment.event!].short, kind: 'event', event: assignment.event!, solves: 0, chronoMs: 0, share: 0 }
        : { key: session.id, label: session.name, kind: 'drill', solves: 0, chronoMs: 0, share: 0 };
      groups.set(key, g);
    }
    g.solves++;
    g.chronoMs += solve.rawMs;
    if (isEvent) eventsMs += solve.rawMs;
    else drillsMs += solve.rawMs;
  }
  const totalMs = eventsMs + drillsMs;
  const groupList = [...groups.values()]
    .map((g) => ({ ...g, share: totalMs ? g.chronoMs / totalMs : 0 }))
    .sort((a, b) => b.chronoMs - a.chronoMs);

  const events = computeEventStats(tagged);
  const eventGroups = groupList.filter((g) => g.kind === 'event');
  const drillGroups = groupList.filter((g) => g.kind === 'drill');

  return {
    year,
    totalSolves: tagged.length,
    eventSolves: eventGroups.reduce((s, g) => s + g.solves, 0),
    drillSolves: drillGroups.reduce((s, g) => s + g.solves, 0),
    removedOutliers,
    chronoMs: { total: totalMs, events: eventsMs, drills: drillsMs },
    practiceMs: practiceTime(tagged.map((t) => t.solve)),
    groups: groupList,
    events,
    mainEvent: eventGroups[0]?.event ?? null,
    favoriteDrill: [...drillGroups].sort((a, b) => b.solves - a.solves)[0] ?? null,
    activity: computeActivity(tagged.map((t) => t.solve.timestamp)),
  };
}

/**
 * Rassemble les solves des sessions retenues (hors "ignore"), filtrés par
 * `keep`, nettoyés des valeurs aberrantes et triés par date.
 */
export function collectSolves(
  data: TimerExport,
  assignments: readonly SessionAssignment[],
  keep: (s: Solve) => boolean = () => true,
): { tagged: TaggedSolve[]; removedOutliers: number } {
  const byId = new Map(assignments.map((a) => [a.sessionId, a]));
  const tagged: TaggedSolve[] = [];
  let removedOutliers = 0;
  for (const session of data.sessions) {
    const assignment = byId.get(session.id);
    if (!assignment || assignment.kind === 'ignore') continue;
    if (assignment.kind === 'event' && !assignment.event) continue;
    const { kept, removed } = removeOutliers(session.solves.filter(keep), assignment);
    removedOutliers += removed;
    for (const solve of kept) tagged.push({ solve, session, assignment });
  }
  tagged.sort((a, b) => a.solve.timestamp - b.solve.timestamp);
  return { tagged, removedOutliers };
}

/**
 * Temps de pratique estimé : pour des solves triés par date, on additionne
 * l'écart avec le solve précédent quand il fait moins de 5 min (il couvre le
 * solve, le scramble et l'inspection). Le premier solve d'une séance compte
 * pour sa seule durée.
 */
export function practiceTime(sorted: readonly Solve[]): number {
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    const gap = i === 0 ? Infinity : sorted[i]!.timestamp - sorted[i - 1]!.timestamp;
    total += gap < PRACTICE_GAP_MS ? gap : sorted[i]!.rawMs;
  }
  return total;
}

export function removeOutliers(
  solves: readonly Solve[],
  assignment: SessionAssignment,
): { kept: Solve[]; removed: number } {
  const floor = assignment.kind === 'event' && assignment.event ? EVENTS[assignment.event].floorMs : DRILL_FLOOR_MS;
  const med = median(solves.map(effectiveMs).filter((t): t is number => t !== null));
  const ceiling = med === null ? Infinity : med * CEILING_FACTOR;
  const kept = solves.filter((s) => {
    const t = s.rawMs;
    return t >= floor && t <= ceiling;
  });
  return { kept, removed: solves.length - kept.length };
}

function computeEventStats(tagged: readonly TaggedSolve[]): EventStats[] {
  const perEvent = new Map<EventId, Solve[]>();
  for (const { solve, assignment } of tagged) {
    if (assignment.kind !== 'event' || !assignment.event) continue;
    const list = perEvent.get(assignment.event) ?? [];
    list.push(solve);
    perEvent.set(assignment.event, list);
  }

  const out: EventStats[] = [];
  for (const [event, solves] of perEvent) {
    const times: Time[] = solves.map(effectiveMs);
    const byMonth: Time[][] = Array.from({ length: 12 }, () => []);
    solves.forEach((s, i) => byMonth[new Date(s.timestamp).getMonth()]!.push(times[i]!));
    out.push({
      event,
      solves: solves.length,
      dnf: times.filter((t) => t === null).length,
      single: bestSingle(times),
      ao5: bestAverage(times, 5),
      ao12: bestAverage(times, 12),
      ao100: bestAverage(times, 100),
      monthlyMean: byMonth.map(meanOf),
      chronoMs: solves.reduce((s, x) => s + x.rawMs, 0),
    });
  }
  return out.sort((a, b) => b.chronoMs - a.chronoMs);
}
