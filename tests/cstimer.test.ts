import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsTimer, TimerParseError } from '../src/lib/timer/cstimer';
import { guessSession } from '../src/lib/timer/classify';
import { effectiveMs } from '../src/lib/timer/types';

const sample = readFileSync(new URL('./fixtures/cstimer-sample.json', import.meta.url), 'utf8');

describe('parseCsTimer', () => {
  const data = parseCsTimer(sample);

  it('lit les sessions et leurs métadonnées, même quand sessionData est une chaîne', () => {
    expect(data.sessions.map((s) => s.name)).toEqual(['🏠 Main', '⏱️ Cross Rush', '🧩 2x2 cll', '🧩 6x6', 'Session 5']);
    expect(data.sessions[0]!.scrambleType).toBe('333');
    expect(data.sessions[2]!.scrambleType).toBe('222eg0');
  });

  it('convertit pénalités et horodatages', () => {
    const main = data.sessions[0]!;
    expect(main.solves).toHaveLength(15);
    const plus2 = main.solves.find((s) => s.penalty === 'plus2')!;
    expect(plus2.rawMs).toBe(13000);
    expect(effectiveMs(plus2)).toBe(15000);
    const dnf = main.solves.find((s) => s.penalty === 'dnf')!;
    expect(effectiveMs(dnf)).toBeNull();
    expect(main.solves[0]!.timestamp).toBe(Date.parse('2025-12-31T22:59:00Z'));
  });

  it('refuse un fichier qui n\'est pas un export csTimer', () => {
    expect(() => parseCsTimer('pas du json')).toThrow(TimerParseError);
    expect(() => parseCsTimer('{"foo": 1}')).toThrow(/Aucune session/);
    expect(() => parseCsTimer('{"session1": []}')).toThrow(/aucun solve/);
  });
});

describe('guessSession', () => {
  const data = parseCsTimer(sample);
  const guess = (i: number) => guessSession(data.sessions[i]!);

  it('reconnaît les épreuves WCA', () => {
    expect(guess(0)).toMatchObject({ kind: 'event', event: '333', needsReview: false });
    expect(guess(3)).toMatchObject({ kind: 'event', event: '666', needsReview: false });
  });

  it('classe un scramble de drill en drill sans demander de vérification', () => {
    expect(guess(2)).toMatchObject({ kind: 'drill', needsReview: false });
  });

  it('signale une session 3x3 bien trop rapide (Cross Rush)', () => {
    expect(guess(1)).toMatchObject({ kind: 'drill', needsReview: true, reason: 'too_fast_for_event', scrambleEvent: '333' });
  });

  it('se sert du nom pour l\'OH, le BLD et les drills', () => {
    const mk = (name: string, ms: number) => ({ id: 'x', name, scrambleType: '333', rank: 1, solves: [{ rawMs: ms, penalty: 'none' as const, timestamp: 1 }] });
    expect(guessSession(mk('OH practice', 20000))).toMatchObject({ kind: 'event', event: '333oh' });
    expect(guessSession(mk('3BLD blind', 60000))).toMatchObject({ kind: 'event', event: '333bf' });
    expect(guessSession(mk('PLL time attack', 35000))).toMatchObject({ kind: 'drill', needsReview: true, reason: 'name_suggests_drill' });
    expect(guessSession({ ...mk('Bizarre', 5000), scrambleType: 'zzz' })).toMatchObject({ kind: 'drill', reason: 'unknown_scramble' });
  });
});
