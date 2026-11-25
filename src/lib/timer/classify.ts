import { EVENTS, type EventId } from '../events';
import { effectiveMs, type TimerSession } from './types';

/**
 * Devine si une session csTimer correspond à une épreuve WCA ou à un drill.
 * Le résultat pré-remplit l'écran "Sessions", où l'utilisateur corrige si besoin.
 */

export type SessionKind = 'event' | 'drill' | 'ignore';

export interface SessionAssignment {
  sessionId: string;
  kind: SessionKind;
  /** Épreuve si kind === 'event'. */
  event?: EventId;
}

export type ReviewReason =
  /** Scramble d'une épreuve, mais temps bien trop rapides pour elle. */
  | 'too_fast_for_event'
  /** Scramble d'une épreuve, mais le nom évoque un drill. */
  | 'name_suggests_drill'
  /** Type de scramble inconnu. */
  | 'unknown_scramble';

export interface SessionGuess extends SessionAssignment {
  needsReview: boolean;
  reason?: ReviewReason;
  /** Épreuve correspondant au scramble, même si on a classé en drill. */
  scrambleEvent?: EventId;
  medianMs: number | null;
}

/** scrType csTimer des épreuves WCA. */
const SCRAMBLE_TO_EVENT: Record<string, EventId> = {
  '333': '333',
  '': '333',
  '222so': '222',
  '222o': '222',
  '444wca': '444',
  '444o': '444',
  '555wca': '555',
  '666wca': '666',
  '777wca': '777',
  '333ni': '333bf',
  '333fm': '333fm',
  '333oh': '333oh',
  clkwca: 'clock',
  mgmp: 'minx',
  pyrso: 'pyram',
  skbso: 'skewb',
  sqrs: 'sq1',
  '444bld': '444bf',
  '555bld': '555bf',
  r3ni: '333mbf',
};

/** scrType csTimer de drills connus (sous-étapes, sets d'algos...). */
const DRILL_SCRAMBLES = new Set([
  '222eg', '222eg0', '222eg1', '222eg2', '222nb', '2gen', '2genl', 'roux', '3gen_F', '3gen_L',
  'easyc', 'easyxc', 'f2l', 'lsll', 'lsll2', 'zbll', 'zzll', 'zbls', 'oll', 'pll', 'coll',
  'cmll', 'cll', 'ell', 'wvls', 'vls', 'ttll', 'eols', '333o', 'lse', 'lsemu', 'cmllsune',
  '333drud', '333cfo', 'cross', 'xcross',
]);

const DRILL_NAME = /\b(oll|pll|cll|coll|cmll|zbll|zbls|f2l|lsll|ell|eg[012]?|cross|x-?cross|drills?|training|algs?|attack|tps|lse|wv|vls|ttll)\b/i;
const OH_NAME = /\b(oh|one[- ]?hand(ed)?)\b/i;
const BLD_NAME = /\b(bld|blind(fold(ed)?)?)\b/i;
const FMC_NAME = /\b(fmc|fewest)\b/i;

export function guessSession(session: TimerSession): SessionGuess {
  const medianMs = median(session.solves.map(effectiveMs).filter((t): t is number => t !== null));
  const base = { sessionId: session.id, medianMs };
  const scr = session.scrambleType;
  const name = session.name;

  if (DRILL_SCRAMBLES.has(scr)) return { ...base, kind: 'drill', needsReview: false };

  let scrambleEvent = SCRAMBLE_TO_EVENT[scr];
  if (!scrambleEvent) {
    return { ...base, kind: 'drill', needsReview: true, reason: 'unknown_scramble' };
  }

  // Un scramble 3x3 sert aussi à l'OH, au BLD et au FMC : le nom tranche.
  if (scrambleEvent === '333') {
    if (OH_NAME.test(name)) scrambleEvent = '333oh';
    else if (BLD_NAME.test(name)) scrambleEvent = '333bf';
    else if (FMC_NAME.test(name)) scrambleEvent = '333fm';
  }

  const info = EVENTS[scrambleEvent];
  if (medianMs !== null && medianMs < info.plausibleMedianMs) {
    return { ...base, kind: 'drill', scrambleEvent, needsReview: true, reason: 'too_fast_for_event' };
  }
  if (DRILL_NAME.test(name)) {
    return { ...base, kind: 'drill', scrambleEvent, needsReview: true, reason: 'name_suggests_drill' };
  }
  return { ...base, kind: 'event', event: scrambleEvent, scrambleEvent, needsReview: false };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
