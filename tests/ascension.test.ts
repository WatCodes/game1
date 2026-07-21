import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { ascend, canAscend, projectedKp } from '../src/engine/ascension';
import { buyResearch } from '../src/engine/research';
import { kpGain, sourceCost } from '../src/engine/formulas';
import { kpDivisor, unitCost } from '../src/content/tiers';
import { CONFIG } from '../src/content/config';

function readyState() {
  const s = createInitialState(0);
  s.sources['battery-bank'].owned = 50;
  s.runPower = 5e5;
  s.rp = 123;
  s.megaproject.committed = s.megaproject.totalCost; // complete
  return s;
}

describe('canAscend', () => {
  it('gates on megaproject completion', () => {
    const s = createInitialState(0);
    expect(canAscend(s)).toBe(false);
    s.megaproject.committed = s.megaproject.totalCost;
    expect(canAscend(s)).toBe(true);
  });

  it('research cost reductions count toward completion', () => {
    const s = createInitialState(0);
    s.rp = 1e9;
    buyResearch(s, 'mega-t0'); // −15%
    s.megaproject.committed = s.megaproject.totalCost * 0.86;
    expect(canAscend(s)).toBe(true);
  });
});

describe('ascend', () => {
  it('does nothing when the gate is closed', () => {
    const s = createInitialState(0);
    expect(ascend(s)).toBe(0);
    expect(s.tier).toBe(0);
  });

  it('banks the projected KP', () => {
    const s = readyState();
    const expected = kpGain(s.runPower, kpDivisor(0));
    expect(projectedKp(s)).toBe(expected);
    expect(ascend(s)).toBe(expected);
    expect(s.kp).toBe(expected);
  });

  it('resets the run but keeps permanent progress', () => {
    const s = readyState();
    s.rp = 777;
    s.credits = 99;
    s.solvers = 2;
    s.grid = { vLevel: 3, aLevel: 2, rLevel: 1 };
    s.accretion.feedRate = 0.7;
    buyResearch(s, 'unlock-coal-plant'); // 20 RP at tier 0
    const rpAfterPurchase = s.rp;

    ascend(s);

    // Reset: buildout, run power, megaproject
    expect(s.tier).toBe(1);
    expect(s.runPower).toBe(0);
    expect(s.sources['battery-bank']).toBeUndefined();
    expect(s.sources['solar-farm'].owned).toBe(0);
    expect(s.megaproject.id).toBe('continental-interconnect');
    expect(s.megaproject.committed).toBe(0);
    // Reset: a fresh circuit dealt for the new tier
    expect(s.puzzle.tier).toBe(1);
    expect(s.puzzle.solved).toBe(false);
    // Reset: delivery infrastructure and tier twists are era-scoped
    expect(s.grid).toEqual({ vLevel: 0, aLevel: 0, rLevel: 0 });
    expect(s.accretion.feedRate).toBe(0);
    // Keep: KP (asserted above), research, RP, credits/solvers, stats
    expect(s.research['unlock-coal-plant'].purchased).toBe(true);
    expect(s.rp).toBe(rpAfterPurchase);
    // credits are kept, plus the new tier's CR seed grant
    const seed = sourceCost(unitCost(1), CONFIG.COST_GROWTH, 0, CONFIG.ASCEND_SEED_UNITS);
    expect(s.credits).toBeCloseTo(99 + seed);
    expect(s.solvers).toBe(2);
    expect(s.stats.ascensions).toBe(1);
  });

  it('grants a CR seed so the new tier is startable', () => {
    const s = readyState();
    s.credits = 0;
    ascend(s);
    const expectedSeed = sourceCost(unitCost(1), CONFIG.COST_GROWTH, 0, CONFIG.ASCEND_SEED_UNITS);
    expect(s.credits).toBeCloseTo(expectedSeed);
    expect(s.power).toBe(0); // the Watt bank is retired
  });

  it('scales the new project with prestige, so it stays a real gate', () => {
    const poor = readyState();
    ascend(poor);
    const rich = readyState();
    rich.runPower = 5e5;
    rich.kp = 1_000_000; // a deeply prestiged run
    ascend(rich);
    // Generation scales with prestige, so the build must too — otherwise it
    // fills in seconds (measured: 1.3s at 17M KP before this fix).
    expect(rich.megaproject.totalCost).toBeGreaterThan(poor.megaproject.totalCost * 1000);
  });

  it('reapplies automation research to the new tier', () => {
    const s = readyState();
    s.rp = 1e9;
    buyResearch(s, 'auto-solar-farm'); // tier gate blocks this at tier 0
    expect(s.research['auto-solar-farm'].purchased).toBeFalsy();
    ascend(s);
    // now at tier 1 it can be bought and applies to the fresh source record
    buyResearch(s, 'auto-solar-farm');
    expect(s.sources['solar-farm'].automated).toBe(true);
  });

  it('reaches the procedural tail beyond tier 7', () => {
    const s = readyState();
    for (let i = 0; i < 9; i++) {
      s.megaproject.committed = s.megaproject.totalCost;
      s.runPower = kpDivisor(s.tier); // enough for some KP
      ascend(s);
    }
    expect(s.tier).toBe(9);
    expect(Object.keys(s.sources).length).toBeGreaterThan(0);
    expect(s.megaproject.id).toContain('exotic-lattice');
  });
});
