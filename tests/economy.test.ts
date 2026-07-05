import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { buy, dispatch, isSourceUnlocked, powerPerSec, runAutomation, sourceOutput } from '../src/engine/economy';
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
  it('doubles a source line at 25 owned', () => {
    const s = state();
    const mods = researchModifiers(s);
    s.sources['battery-bank'].owned = 24;
    const at24 = sourceOutput(s.sources['battery-bank'], mods);
    s.sources['battery-bank'].owned = 25;
    const at25 = sourceOutput(s.sources['battery-bank'], mods);
    // 25/24 units × the ×2 milestone
    expect(at25 / at24).toBeCloseTo((25 / 24) * 2);
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
  it('grants a demand-scaled burst and starts the cooldown', () => {
    const s = state();
    s.sources['battery-bank'].owned = 10; // 5 W/s
    const result = dispatch(s, 1000, () => 0.5); // demand = 0.75 + 0.35 = 1.1
    expect(result).not.toBeNull();
    expect(result!.gained).toBeCloseTo(powerPerSec(s) * CONFIG.DISPATCH_SECONDS * 1.1);
    expect(s.dispatchReadyAt).toBe(1000 + CONFIG.DISPATCH_COOLDOWN_MS);
    expect(dispatch(s, 2000, () => 0.5)).toBeNull(); // still cooling down
  });
});
