/**
 * Format interne commun à tous les timers. Chaque parser (csTimer en V1,
 * d'autres plus tard) convertit son export vers ces types, et les calculs
 * de stats ne connaissent que ce format.
 */

export type Penalty = 'none' | 'plus2' | 'dnf';

export interface Solve {
  /** Temps brut affiché par le timer, sans la pénalité, en millisecondes. */
  rawMs: number;
  penalty: Penalty;
  /** Instant d'enregistrement du solve (fin du solve), en ms epoch. */
  timestamp: number;
  scramble?: string;
  comment?: string;
}

export interface TimerSession {
  id: string;
  name: string;
  /** Type de scramble déclaré par le timer (ex. "333", "222so", "oll"). */
  scrambleType: string;
  /** Ordre d'affichage dans le timer. */
  rank: number;
  solves: Solve[];
}

export type TimerSource = 'cstimer';

export interface TimerExport {
  source: TimerSource;
  sessions: TimerSession[];
}

/** Temps effectif en ms (pénalité incluse), ou null pour un DNF. */
export function effectiveMs(solve: Solve): number | null {
  if (solve.penalty === 'dnf') return null;
  return solve.penalty === 'plus2' ? solve.rawMs + 2000 : solve.rawMs;
}
