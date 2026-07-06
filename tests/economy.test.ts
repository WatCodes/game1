import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import {
  buy,
  fireDispatch,
  isSourceUnlocked,
  nextUnitNet,
  powerPerSec,
  runAutomation,
  sourceGross,
  sourceNet,
  sourceUpkeep,
  tickDispatch,
} from '../src/engine/economy';
import { buyResearch, researchModifiers } from '../src/engine/research';
import { sourceCost, globalMilestoneMult, prestigeMult } from '../src/engine/formulas';
import { CONFIG } from '../src/content/config';

function state() {
  return createInitialState(0);
}

describe('buy', () => {
  it('deducts the exact cost and adds units', () => {
    const s = state();
    s.power = 1000;
    expect(buy(s, 'battery-bank', 1)).toBe(1);
    expect(s.sources['battery-bank'].owned).toBe(1);
    expect(s.power).toBeCloseTo(990);
  });

  it('refuses unaffordable purchases', () => {
    const s = state();
    s.power = 5;
    expect(buy(s, 'battery-bank', 1)).toBe(0);
    expect(s.power).toBe(5);
  });

  it('buy max solves the geometric sum exactly', () => {
    const s = state();
    s.power = sourceCost(10, CONFIG.COST_GROWTH, 0, 5);
    expect(buy(s, 'battery-bank', 'max')).toBe(5);
    expect(s.power).toBeCloseTo(0, 6);
  });

  it('refuses locked sources', () => {
    const s = state();
    s.power = 1e12;
    expect(isSourceUnlocked(s, s.sources['coal-plant'])).toBe(false);
    expect(buy(s, 'coal-plant', 1)).toBe(0);
  });

  it('research unlocks gated sources', () => {
    const s = state();
    s.rp = 1e6;
    buyResearch(s, 'unlock-coal-plant');
    expect(isSourceUnlocked(s, s.sources['coal-plant'])).toBe(true);
  });
});

describe('milestones flip output', () => {
  it('doubles a source line at 25 owned (gross)', () => {
    const s = state();
    const mods = researchModifiers(s);
    const src = s.sources['battery-bank'];
    src.owned = 24;
    const at24 = sourceGross(src, mods);
    src.owned = 25;
    const at25 = sourceGross(src, mods);
    // 25/24 units × the ×2 milestone
    expect(at25 / at24).toBeCloseTo((25 / 24) * 2);
  });
});

describe('fuel & upkeep', () => {
  it('net = gross − quadratic upkeep, floored at zero', () => {
    const s = state();
    const mods = researchModifiers(s);
    const src = s.sources['battery-bank'];
    src.owned = 30; // past the ×2 milestone
    const gross = 30 * 0.5 * 2;
    const upkeep = src.baseUpkeep * ((30 * 29) / 2);
    expect(sourceUpkeep(src, mods)).toBeCloseTo(upkeep);
    expect(sourceNet(src, mods)).toBeCloseTo(gross - upkeep);
  });

  it('a single unit pays no upkeep', () => {
    const s = state();
    const src = s.sources['battery-bank'];
    src.owned = 1;
    expect(sourceUpkeep(src, researchModifiers(s))).toBe(0);
  });

  it('overbuying curtails: the next unit can be a net loss', () => {
    const s = state();
    const mods = researchModifiers(s);
    const src = s.sources['battery-bank'];
    // marginal ≈ baseOutput×mult − baseUpkeep×owned; with mult 4 (50..99) it
    // crosses zero at owned = 4×0.5/0.025 = 80
    src.owned = 79;
    expect(nextUnitNet(src, mods)).toBeGreaterThan(0);
    src.owned = 85;
    expect(nextUnitNet(src, mods)).toBeLessThan(0);
    // ...but the ×2 at 100 rescues it: buying unit 100 jumps output
    src.owned = 99;
    expect(nextUnitNet(src, mods)).toBeGreaterThan(0);
  });

  it('efficiency research halves upkeep', () => {
    const s = state();
    const src = s.sources['battery-bank'];
    src.owned = 30;
    const before = sourceUpkeep(src, researchModifiers(s));
    s.rp = 1e9;
    buyResearch(s, 'eff-t0');
    expect(sourceUpkeep(src, researchModifiers(s))).toBeCloseTo(before / 2);
  });
});

describe('powerPerSec multiplier order', () => {
  it('composes source → global milestone → era → prestige → research global', () => {
    const s = state();
    s.sources['battery-bank'].owned = 1; // 0.5 W/s base
    s.runPower = 1e6; // 2 global milestones → ×1.6²
    s.kp = 50; // prestige ×2
    s.rp = 1e9;
    buyResearch(s, 'boost-battery-bank'); // battery ×2
    buyResearch(s, 'global-t0'); // global ×1.5
    const expected = 0.5 * 2 * globalMilestoneMult(1e6) * 1 /* era t0 */ * prestigeMult(50) * 1.5;
    expect(powerPerSec(s)).toBeCloseTo(expected);
  });
});

describe('automation', () => {
  it('managers buy one unit per tick while affordable', () => {
    const s = state();
    s.rp = 1e9;
    buyResearch(s, 'auto-battery-bank');
    expect(s.sources['battery-bank'].automated).toBe(true);
    s.power = 25;
    runAutomation(s); // buys one at 10
    expect(s.sources['battery-bank'].owned).toBe(1);
    runAutomation(s); // second costs 11.3
    expect(s.sources['battery-bank'].owned).toBe(2);
    runAutomation(s); // third costs 12.77 > remaining
    expect(s.sources['battery-bank'].owned).toBe(2);
  });
});

describe('dispatch', () => {
  function generating() {
    const s = state();
    s.sources['battery-bank'].owned = 10;
    return s;
  }

  it('cannot fire below minimum charge', () => {
    const s = generating();
    s.dispatch.charge = CONFIG.DISPATCH_MIN_CHARGE - 0.01;
    expect(fireDispatch(s, () => 0.5)).toBeNull();
  });

  it('burst scales with charge and demand, then resets charge', () => {
    const s = generating();
    s.dispatch.charge = 0.5;
    const pps = powerPerSec(s);
    const result = fireDispatch(s, () => 0.5); // demand = 0.9 + 0.15 = 1.05
    expect(result).not.toBeNull();
    expect(result!.peak).toBe(false);
    expect(result!.gained).toBeCloseTo(pps * CONFIG.DISPATCH_SECONDS * 0.5 * 1.05);
    expect(s.dispatch.charge).toBe(0);
    expect(fireDispatch(s, () => 0.5)).toBeNull(); // spent
  });

  it('peak windows multiply the burst', () => {
    const s = generating();
    s.dispatch.charge = 1;
    s.dispatch.peakLeft = 10;
    const pps = powerPerSec(s);
    const result = fireDispatch(s, () => 0.5)!;
    expect(result.peak).toBe(true);
    expect(result.gained).toBeCloseTo(pps * CONFIG.DISPATCH_SECONDS * 1 * 1.05 * CONFIG.PEAK_MULT);
  });

  it('charge builds over time and peak windows open on schedule', () => {
    const s = generating();
    tickDispatch(s, CONFIG.DISPATCH_CHARGE_SECONDS / 2, () => 0.5);
    expect(s.dispatch.charge).toBeCloseTo(0.5);
    tickDispatch(s, CONFIG.DISPATCH_CHARGE_SECONDS * 2, () => 0.5);
    expect(s.dispatch.charge).toBe(1); // clamped
    // burn down to the next peak window
    s.dispatch.nextPeakIn = 1;
    tickDispatch(s, 1.5, () => 0.5);
    expect(s.dispatch.peakLeft).toBe(CONFIG.PEAK_DURATION_SECONDS);
    expect(s.dispatch.nextPeakIn).toBeCloseTo(
      CONFIG.PEAK_GAP_MIN_SECONDS + 0.5 * (CONFIG.PEAK_GAP_MAX_SECONDS - CONFIG.PEAK_GAP_MIN_SECONDS),
    );
  });
});
