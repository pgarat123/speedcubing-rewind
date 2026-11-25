import { describe, expect, it } from 'vitest';
import { averageOf, bestAverage, bestSingle, trimCount } from '../src/lib/stats/averages';

describe('moyennes', () => {
  it('coupe 5 % de chaque côté, arrondi au supérieur', () => {
    expect([3, 5, 12, 50, 100].map(trimCount)).toEqual([0, 1, 1, 3, 5]);
  });

  it('calcule une ao5 avec un DNF compté comme pire temps', () => {
    expect(averageOf([10, 12, null, 11, 9])).toBe(11);
    expect(averageOf([10, null, null, 11, 9])).toBeNull();
  });

  it('mo3 sans coupe', () => {
    expect(averageOf([10, 11, 12])).toBe(11);
    expect(averageOf([10, null, 12])).toBeNull();
  });

  it('trouve le meilleur single et la meilleure moyenne glissante', () => {
    const t = [12, 11, 15, 10, 12, null, 12, 11, 12, 10, 12];
    expect(bestSingle(t)).toBe(10);
    expect(bestSingle([null, null])).toBeNull();
    expect(bestAverage(t, 5)).toBeCloseTo(35 / 3);
    expect(bestAverage([1, 2, 3], 5)).toBeNull();
  });
});
