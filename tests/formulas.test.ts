import { describe, expect, it } from 'vitest';
import {
  buyMaxCount,
  globalMilestoneCount,
  globalMilestoneMult,
  kpGain,
  nextGlobalMilestone,
  nextSourceMilestone,
  offlineSeconds,
  prestigeMult,
  sourceCost,
  sourceMilestoneCount,
  sourceMilestoneMult,
  upkeepFor,
} from '../src/engine/formulas';
import { formatPower, formatShort, formatTime } from '../src/engine/format';

describe('sourceCost', () => {
  it('costs baseCost for the first unit', () => {
    expect(sourceCost(10, 1.13, 0, 1)).toBeCloseTo(10);
  });

  it('grows geometrically with owned count', () => {
    expect(sourceCost(10, 1.13, 3, 1)).toBeCloseTo(10 * 1.13 ** 3);
  });

  it('sums the series for multi-buys', () => {
    expect(sourceCost(10, 1.13, 0, 3)).toBeCloseTo(10 + 10 * 1.13 + 10 * 1.13 ** 2);
  });

  it('returns 0 for non-positive counts', () => {
    expect(sourceCost(10, 1.13, 5, 0)).toBe(0);
  });
});

describe('buyMaxCount', () => {
  it('returns 0 when the first unit is unaffordable', () => {
    expect(buyMaxCount(10, 1.13, 0, 9.99)).toBe(0);
  });

  it('is exact at series boundaries', () => {
    const budget = sourceCost(10, 1.13, 0, 7);
    expect(buyMaxCount(10, 1.13, 0, budget)).toBe(7);
    expect(buyMaxCount(10, 1.13, 0, budget - 0.01)).toBe(6);
  });

  it('never exceeds the budget (inverse property)', () => {
    for (const budget of [10, 137, 5000, 1e6, 3.7e9]) {
      const n = buyMaxCount(10, 1.13, 12, budget);
      expect(sourceCost(10, 1.13, 12, n)).toBeLessThanOrEqual(budget * (1 + 1e-9));
      expect(sourceCost(10, 1.13, 12, n + 1)).toBeGreaterThan(budget);
    }
  });
});

describe('source milestones', () => {
  it('counts table thresholds', () => {
    expect(sourceMilestoneCount(0)).toBe(0);
    expect(sourceMilestoneCount(24)).toBe(0);
    expect(sourceMilestoneCount(25)).toBe(1);
    expect(sourceMilestoneCount(100)).toBe(3);
    expect(sourceMilestoneCount(1000)).toBe(10);
  });

  it('continues every 500 past the table', () => {
    expect(sourceMilestoneCount(1499)).toBe(10);
    expect(sourceMilestoneCount(1500)).toBe(11);
    expect(sourceMilestoneCount(2000)).toBe(12);
  });

  it('doubles output per milestone', () => {
    expect(sourceMilestoneMult(25)).toBe(2);
    expect(sourceMilestoneMult(100)).toBe(8);
  });

  it('reports the next threshold for the UI hint', () => {
    expect(nextSourceMilestone(0)).toBe(25);
    expect(nextSourceMilestone(25)).toBe(50);
    expect(nextSourceMilestone(999)).toBe(1000);
    expect(nextSourceMilestone(1000)).toBe(1500);
  });
});

describe('global milestones', () => {
  it('matches the spec formula (GAME_DESIGN §3.5)', () => {
    expect(globalMilestoneCount(999)).toBe(0);
    expect(globalMilestoneCount(1000)).toBe(1);
    expect(globalMilestoneCount(999_999)).toBe(1);
    expect(globalMilestoneCount(1e6)).toBe(2);
    expect(globalMilestoneCount(1e9)).toBe(3);
  });

  it('applies ×1.6 per milestone', () => {
    expect(globalMilestoneMult(1e6)).toBeCloseTo(1.6 ** 2);
  });

  it('reports the next threshold', () => {
    expect(nextGlobalMilestone(0)).toBe(1000);
    expect(nextGlobalMilestone(1000)).toBe(1e6);
  });
});

describe('kp', () => {
  it('pays out on the sqrt curve', () => {
    expect(kpGain(7e4, 7e4)).toBe(3); // K × sqrt(1)
    expect(kpGain(2.8e5, 7e4)).toBe(6); // K × sqrt(4)
    expect(kpGain(0, 7e4)).toBe(0);
  });

  it('prestige is +2% per KP', () => {
    expect(prestigeMult(0)).toBe(1);
    expect(prestigeMult(50)).toBeCloseTo(2);
  });
});

describe('upkeepFor', () => {
  it('is zero for zero or one unit', () => {
    expect(upkeepFor(0.025, 0)).toBe(0);
    expect(upkeepFor(0.025, 1)).toBe(0);
  });

  it('grows quadratically: unit k drags baseUpkeep×(k−1)', () => {
    expect(upkeepFor(0.025, 2)).toBeCloseTo(0.025); // 0 + 1
    expect(upkeepFor(0.025, 5)).toBeCloseTo(0.025 * 10); // 0+1+2+3+4
  });

  it('scales with the efficiency multiplier', () => {
    expect(upkeepFor(0.025, 10, 0.5)).toBeCloseTo(upkeepFor(0.025, 10) / 2);
  });
});

describe('offlineSeconds', () => {
  it('clamps to the cap and floors at zero', () => {
    expect(offlineSeconds(3_600_000, 14400)).toBe(3600);
    expect(offlineSeconds(100 * 3_600_000, 14400)).toBe(14400);
    expect(offlineSeconds(-5000, 14400)).toBe(0);
  });
});

describe('formatPower', () => {
  it('handles the unit ladder boundaries', () => {
    expect(formatPower(999)).toBe('999 W');
    expect(formatPower(1000)).toBe('1.00 kW');
    expect(formatPower(5)).toBe('5.0 W');
    expect(formatPower(1.5e9)).toBe('1.50 GW');
    expect(formatPower(1e24)).toBe('1.00 YW');
  });

  it('switches to scientific above YW', () => {
    expect(formatPower(1e27)).toBe('1.00e27 W');
  });
});

describe('formatShort / formatTime', () => {
  it('short-forms large counts', () => {
    expect(formatShort(999)).toBe('999');
    expect(formatShort(1500)).toBe('1.50K');
  });

  it('formats durations', () => {
    expect(formatTime(45)).toBe('45s');
    expect(formatTime(3900)).toBe('1h 5m');
  });
});
