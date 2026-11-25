import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsTimer } from '../src/lib/timer/cstimer';
import { guessSession } from '../src/lib/timer/classify';
import { computeTrainingStats, practiceTime } from '../src/lib/stats/training';
import { longestStreak } from '../src/lib/stats/activity';
import type { Solve } from '../src/lib/timer/types';

const data = parseCsTimer(readFileSync(new URL('./fixtures/cstimer-sample.json', import.meta.url), 'utf8'));
const stats = computeTrainingStats(data, data.sessions.map(guessSession), 2026);

describe('computeTrainingStats', () => {
  it('ne garde que l\'année demandée et écarte les valeurs aberrantes', () => {
    // 3x3 : 14 solves en 2026 dont un 0.12 s ; 2x2 CLL : un chrono oublié à 40 s.
    expect(stats.removedOutliers).toBe(2);
    expect(stats.eventSolves).toBe(13 + 2);
    expect(stats.drillSolves).toBe(15 + 10);
    expect(stats.totalSolves).toBe(40);
  });

  it('calcule les records maison de l\'épreuve', () => {
    const e333 = stats.events.find((e) => e.event === '333')!;
    expect(e333.single).toBe(10900);
    expect(e333.dnf).toBe(1);
    expect(e333.ao5).toBeCloseTo((11800 + 12100 + 11700) / 3);
    expect(e333.ao100).toBeNull();
    expect(e333.monthlyMean[6]).not.toBeNull();
  });

  it('mesure le temps passé par groupe plutôt que le nombre de solves', () => {
    // 2 solves de 6x6 pèsent plus que 13 solves de 3x3.
    expect(stats.groups[0]!.label).toBe('6x6');
    expect(stats.mainEvent).toBe('666');
    expect(stats.chronoMs.total).toBe(stats.chronoMs.events + stats.chronoMs.drills);
    expect(stats.groups.reduce((s, g) => s + g.share, 0)).toBeCloseTo(1);
    expect(stats.favoriteDrill?.label).toBe('⏱️ Cross Rush');
  });

  it('calcule les habitudes dans le fuseau local', () => {
    const a = stats.activity;
    expect(a.activeDays).toBe(4);
    expect(a.longestStreak).toEqual({ days: 3, start: '2026-07-15', end: '2026-07-17' });
    expect(a.lateEveningShare).toBeCloseTo(13 / 40);
    expect(a.perMonth[6]).toBe(38);
    expect(a.busiestDay).toEqual({ date: '2026-07-17', solves: 25 });
    expect(a.heatmap[2]![22]).toBe(11); // mercredi 15 juillet, 22 h
  });
});

describe('practiceTime', () => {
  const s = (sec: number, rawMs = 10_000): Solve => ({ rawMs, penalty: 'none', timestamp: sec * 1000 });

  it('additionne les écarts de moins de 5 min et compte le premier solve de chaque séance', () => {
    // Séance 1 : 3 solves espacés de 30 s. Pause de 2 h. Séance 2 : 2 solves espacés de 60 s.
    const solves = [s(0), s(30), s(60), s(7260), s(7320)];
    expect(practiceTime(solves)).toBe(10_000 + 60_000 + 10_000 + 60_000);
  });
});

describe('longestStreak', () => {
  it('traverse le changement d\'heure et les fins de mois', () => {
    expect(longestStreak(['2026-03-28', '2026-03-29', '2026-03-30', '2026-04-01'])).toEqual({ days: 3, start: '2026-03-28', end: '2026-03-30' });
    expect(longestStreak([])).toBeNull();
  });
});
