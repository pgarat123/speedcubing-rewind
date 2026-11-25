/** Épreuves WCA et seuils utilisés pour reconnaître les sessions csTimer. */

export const EVENT_IDS = [
  '333', '222', '444', '555', '666', '777', '333bf', '333fm', '333oh',
  'clock', 'minx', 'pyram', 'skewb', 'sq1', '444bf', '555bf', '333mbf',
] as const;

export type EventId = (typeof EVENT_IDS)[number];

export function isEventId(v: string): v is EventId {
  return (EVENT_IDS as readonly string[]).includes(v);
}

export interface EventInfo {
  /** Nom court affiché (identique en FR et EN pour les puzzles). */
  short: string;
  /**
   * Single en dessous duquel un temps est considéré comme une erreur de chrono
   * (environ 80 % du record du monde). Sert au filtrage des valeurs aberrantes.
   */
  floorMs: number;
  /**
   * Temps médian minimal plausible pour une vraie session de l'épreuve.
   * Une session plus rapide est presque sûrement un drill (cross, PLL...).
   */
  plausibleMedianMs: number;
}

export const EVENTS: Record<EventId, EventInfo> = {
  '333': { short: '3x3', floorMs: 2_500, plausibleMedianMs: 5_000 },
  '222': { short: '2x2', floorMs: 350, plausibleMedianMs: 1_000 },
  '444': { short: '4x4', floorMs: 12_000, plausibleMedianMs: 18_000 },
  '555': { short: '5x5', floorMs: 25_000, plausibleMedianMs: 35_000 },
  '666': { short: '6x6', floorMs: 45_000, plausibleMedianMs: 60_000 },
  '777': { short: '7x7', floorMs: 70_000, plausibleMedianMs: 90_000 },
  '333bf': { short: '3BLD', floorMs: 9_000, plausibleMedianMs: 13_000 },
  '333fm': { short: 'FMC', floorMs: 0, plausibleMedianMs: 0 },
  '333oh': { short: '3x3 OH', floorMs: 5_000, plausibleMedianMs: 7_000 },
  clock: { short: 'Clock', floorMs: 1_200, plausibleMedianMs: 2_500 },
  minx: { short: 'Megaminx', floorMs: 20_000, plausibleMedianMs: 30_000 },
  pyram: { short: 'Pyraminx', floorMs: 500, plausibleMedianMs: 1_500 },
  skewb: { short: 'Skewb', floorMs: 600, plausibleMedianMs: 1_500 },
  sq1: { short: 'Square-1', floorMs: 2_500, plausibleMedianMs: 5_000 },
  '444bf': { short: '4BLD', floorMs: 40_000, plausibleMedianMs: 60_000 },
  '555bf': { short: '5BLD', floorMs: 90_000, plausibleMedianMs: 120_000 },
  '333mbf': { short: 'MBLD', floorMs: 0, plausibleMedianMs: 0 },
};

/** Seuil de filtrage pour les drills, dont les temps peuvent être très courts. */
export const DRILL_FLOOR_MS = 200;
