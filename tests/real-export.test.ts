// Vérification manuelle sur un vrai export, jamais versionné :
//   CSTIMER_EXPORT=~/Downloads/cstimer_xxx.txt npm test -- real-export
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsTimer } from '../src/lib/timer/cstimer';
import { guessSession } from '../src/lib/timer/classify';
import { computeTrainingStats } from '../src/lib/stats/training';

const file = process.env.CSTIMER_EXPORT;
const year = Number(process.env.YEAR ?? 2026);

describe.skipIf(!file)('export réel', () => {
  it('affiche le classement des sessions et les stats', () => {
    const data = parseCsTimer(readFileSync(file!, 'utf8'));
    const guesses = data.sessions.map(guessSession);
    for (const [i, s] of data.sessions.entries()) {
      const g = guesses[i]!;
      const n = s.solves.filter((x) => new Date(x.timestamp).getFullYear() === year).length;
      if (!n) continue;
      console.log(`${s.id.padStart(3)} ${s.name.padEnd(26)} ${s.scrambleType.padEnd(8)} n=${String(n).padStart(5)} med=${((g.medianMs ?? 0) / 1000).toFixed(2)} → ${g.kind}${g.event ? ' ' + g.event : ''}${g.needsReview ? ' [à vérifier: ' + g.reason + ']' : ''}`);
    }
    const stats = computeTrainingStats(data, guesses, year);
    const h = (ms: number) => (ms / 3.6e6).toFixed(2) + ' h';
    const { activity: a, ...r } = stats;
    console.log({
      total: r.totalSolves, events: r.eventSolves, drills: r.drillSolves, removed: r.removedOutliers,
      chrono: h(r.chronoMs.total), chronoEvents: h(r.chronoMs.events), chronoDrills: h(r.chronoMs.drills),
      practice: h(r.practiceMs), main: r.mainEvent, favDrill: r.favoriteDrill?.label,
    });
    console.log(r.groups.slice(0, 8).map((g) => `${g.label} ${g.kind} n=${g.solves} ${(g.share * 100).toFixed(1)}%`).join('\n'));
    console.log(r.events.map((e) => `${e.event} n=${e.solves} single=${e.single} ao5=${e.ao5?.toFixed(0)} ao12=${e.ao12?.toFixed(0)} ao100=${e.ao100?.toFixed(0)}`).join('\n'));
    console.log({ activeDays: a.activeDays, streak: a.longestStreak, busiest: a.busiestDay, perMonth: a.perMonth.join(' '), weekday: a.perWeekday.join(' '), late: a.lateEveningShare.toFixed(3), period: a.dominantPeriod });
    expect(stats.totalSolves).toBeGreaterThan(0);
  });
});
