/**
 * Affichage des temps et des nombres.
 * Les temps de solve suivent la notation speedcubing (12.76, 1:07.84) quelle
 * que soit la langue ; les autres décimales suivent la locale (29,3 h en FR).
 */

/** Temps en centièmes (WCA) vers "12.76" ou "1:07.84". DNF/DNS pour -1/-2. */
export function formatCs(cs: number): string {
  if (cs === -1) return 'DNF';
  if (cs === -2) return 'DNS';
  if (cs <= 0) return '';
  const total = Math.round(cs);
  const minutes = Math.floor(total / 6000);
  const rest = total - minutes * 6000;
  const sec = Math.floor(rest / 100);
  const hund = String(rest % 100).padStart(2, '0');
  return minutes > 0 ? `${minutes}:${String(sec).padStart(2, '0')}.${hund}` : `${sec}.${hund}`;
}

/** Temps en ms vers la notation speedcubing, tronqué au centième comme les timers. */
export function formatMs(ms: number | null): string {
  if (ms === null) return 'DNF';
  return formatCs(Math.floor(ms / 10 + 1e-6));
}

/** Résultat WCA selon l'épreuve (FMC en coups, MBLD décodé). */
export function formatWcaResult(event: string, value: number, kind: 'single' | 'average'): string {
  if (value <= 0) return formatCs(value);
  if (event === '333fm') return kind === 'single' ? String(value) : (value / 100).toFixed(2);
  if (event === '333mbf') return formatMbld(value);
  return formatCs(value);
}

/** Décode le format MBLD 0DDTTTTTMM : "solved/attempted mm:ss". */
export function formatMbld(value: number): string {
  const missed = value % 100;
  const seconds = Math.floor(value / 100) % 100_000;
  const diff = 99 - Math.floor(value / 10_000_000);
  const solved = diff + missed;
  const attempted = solved + missed;
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${solved}/${attempted} ${m}:${s}`;
}

/** Durée en heures pour les cartes : "29 h" au-delà de 10 h, "8 h 52 min" en dessous. */
export function formatDuration(ms: number): { hours: number; minutes: number } {
  const totalMin = Math.round(ms / 60_000);
  return { hours: Math.floor(totalMin / 60), minutes: totalMin % 60 };
}

/** Nombre avec séparateur de milliers de la locale ("3 759" en FR, "3,759" en EN). */
export function formatInt(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

/** Pourcentage entier ("58 %" en FR, "58%" en EN). */
export function formatPercent(share: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(share);
}
