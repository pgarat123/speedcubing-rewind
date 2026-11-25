/**
 * Moyennes façon WCA / csTimer. Un temps vaut null pour un DNF.
 * Pour une moyenne de n temps, on retire ceil(5 % de n) temps de chaque côté
 * (1 pour ao5 et ao12, 5 pour ao100). Les DNF comptent comme les pires temps ;
 * s'il y en a plus que de temps retirés, la moyenne est DNF (null).
 * En dessous de 5 temps (mo3), aucune coupe : un seul DNF suffit à rendre DNF.
 */

export type Time = number | null;

export function trimCount(n: number): number {
  return n < 5 ? 0 : Math.ceil(n * 0.05);
}

export function averageOf(times: readonly Time[]): number | null {
  const n = times.length;
  if (n === 0) return null;
  const trim = trimCount(n);
  const dnf = times.filter((t) => t === null).length;
  if (dnf > trim) return null;
  const sorted = times.filter((t): t is number => t !== null).sort((a, b) => a - b);
  // Les DNF occupent la fin de la liste triée, donc les `trim` pires places.
  const kept = sorted.slice(trim, n - trim);
  return kept.reduce((s, t) => s + t, 0) / kept.length;
}

export function bestSingle(times: readonly Time[]): number | null {
  let best: number | null = null;
  for (const t of times) if (t !== null && (best === null || t < best)) best = t;
  return best;
}

/** Meilleure moyenne glissante de n temps consécutifs, ou null. */
export function bestAverage(times: readonly Time[], n: number): number | null {
  let best: number | null = null;
  for (let i = 0; i + n <= times.length; i++) {
    const a = averageOf(times.slice(i, i + n));
    if (a !== null && (best === null || a < best)) best = a;
  }
  return best;
}

/** Moyenne simple des temps hors DNF, ou null. */
export function meanOf(times: readonly Time[]): number | null {
  const ok = times.filter((t): t is number => t !== null);
  return ok.length ? ok.reduce((s, t) => s + t, 0) / ok.length : null;
}
