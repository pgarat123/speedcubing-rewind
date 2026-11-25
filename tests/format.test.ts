import { describe, expect, it } from 'vitest';
import { formatCs, formatDuration, formatInt, formatMbld, formatMs, formatPercent, formatWcaResult } from '../src/lib/format';

describe('format', () => {
  it('affiche les temps en notation speedcubing', () => {
    expect(formatCs(1276)).toBe('12.76');
    expect(formatCs(6784)).toBe('1:07.84');
    expect(formatCs(-1)).toBe('DNF');
    expect(formatMs(7700)).toBe('7.70');
    expect(formatMs(12761.3)).toBe('12.76');
    expect(formatMs(null)).toBe('DNF');
  });

  it('gère FMC et MBLD', () => {
    expect(formatWcaResult('333fm', 28, 'single')).toBe('28');
    expect(formatWcaResult('333fm', 3033, 'average')).toBe('30.33');
    // 9/10 en 58:23 : différence 8 → DD = 91, 3503 s, 1 raté.
    expect(formatMbld(910350301)).toBe('9/10 58:23');
  });

  it('suit la locale pour les nombres', () => {
    expect(formatInt(3759, 'fr-FR').replace(/\s/g, ' ')).toBe('3 759');
    expect(formatInt(3759, 'en')).toBe('3,759');
    expect(formatPercent(0.58, 'en')).toBe('58%');
    expect(formatDuration(8.86 * 3.6e6)).toEqual({ hours: 8, minutes: 52 });
  });
});
