import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import {
  bindingConstraint,
  buyGridUpgrade,
  deliverPower,
  displayAmps,
  displayVolts,
  gridUpgradeCost,
  lossFraction,
  transmissionCap,
} from '../src/engine/grid';
import { generationPerSec, powerPerSec } from '../src/engine/economy';
import { ascend } from '../src/engine/ascension';
import { GRID, gridCapBase, gridCostBase } from '../src/content/grid';

function state() {
  return createInitialState(0);
}

describe('transmission cap', () => {
  it('scales with transformer and conductor levels', () => {
    const s = state();
    expect(transmissionCap(s)).toBeCloseTo(gridCapBase(0));
    s.grid.vLevel = 2;
    s.grid.aLevel = 1;
    expect(transmissionCap(s)).toBeCloseTo(gridCapBase(0) * GRID.V_CAP_STEP ** 2 * GRID.A_CAP_STEP);
  });

  it('volts × amps equals the cap (display consistency)', () => {
    const s = state();
    s.grid.vLevel = 3;
    s.grid.aLevel = 2;
    expect(displayVolts(s) * displayAmps(s)).toBeCloseTo(transmissionCap(s));
  });
});

describe('losses', () => {
  it('voltage and superconductors both cut I²R losses', () => {
    const s = state();
    expect(lossFraction(s)).toBeCloseTo(GRID.LOSS_BASE);
    s.grid.vLevel = 1;
    expect(lossFraction(s)).toBeCloseTo(GRID.LOSS_BASE / GRID.LOSS_V_STEP);
    s.grid.rLevel = 1;
    expect(lossFraction(s)).toBeCloseTo(GRID.LOSS_BASE / GRID.LOSS_V_STEP / GRID.LOSS_R_STEP);
  });

  it('losses floor out, never reach zero', () => {
    const s = state();
    s.grid.vLevel = 50;
    s.grid.rLevel = 50;
    expect(lossFraction(s)).toBe(GRID.LOSS_FLOOR);
  });
});

describe('delivery', () => {
  it('delivered = min(generation, cap) × (1 − loss)', () => {
    const s = state();
    const cap = transmissionCap(s);
    expect(deliverPower(s, cap / 2)).toBeCloseTo((cap / 2) * (1 - GRID.LOSS_BASE));
    expect(deliverPower(s, cap * 10)).toBeCloseTo(cap * (1 - GRID.LOSS_BASE)); // congested
  });

  it('powerPerSec is delivered generation', () => {
    const s = state();
    s.sources['battery-bank'].owned = 1;
    expect(powerPerSec(s)).toBeCloseTo(deliverPower(s, generationPerSec(s)));
  });

  it('reports the binding constraint', () => {
    const s = state();
    expect(bindingConstraint(s, transmissionCap(s) / 2)).toBe('generation');
    expect(bindingConstraint(s, transmissionCap(s) * 2)).toBe('transmission');
  });
});

describe('upgrades', () => {
  it('costs grow per level and purchases deduct CR', () => {
    const s = state();
    expect(gridUpgradeCost(s, 'v')).toBeCloseTo(gridCostBase(0, 'v'));
    s.credits = gridUpgradeCost(s, 'v');
    expect(buyGridUpgrade(s, 'v')).toBe(true);
    expect(s.grid.vLevel).toBe(1);
    expect(s.credits).toBeCloseTo(0, 6);
    expect(gridUpgradeCost(s, 'v')).toBeCloseTo(gridCostBase(0, 'v') * GRID.V_COST_GROWTH);
    expect(buyGridUpgrade(s, 'v')).toBe(false); // broke
  });

  it('pre-grid saves are grandfathered: enough levels to carry current generation', async () => {
    const { hydrate, validateSave, serialize } = await import('../src/store/save');
    const s = state();
    s.sources['battery-bank'].owned = 1000; // huge run: gen far above a level-0 cap
    s.kp = 100;
    const save = serialize(s) as unknown as Record<string, unknown>;
    save.version = 4;
    delete save.grid;
    const restored = hydrate(validateSave(save));
    expect(transmissionCap(restored)).toBeGreaterThanOrEqual(generationPerSec(restored));
    expect(restored.grid.vLevel).toBeGreaterThan(0);
  });

  it('infrastructure resets on ascension', () => {
    const s = state();
    s.grid = { vLevel: 4, aLevel: 3, rLevel: 2 };
    s.megaproject.stagesAuthorized = s.megaproject.stages.length;
    s.megaproject.committed = s.megaproject.totalCost;
    s.runPower = 5e5;
    ascend(s);
    expect(s.grid).toEqual({ vLevel: 0, aLevel: 0, rLevel: 0 });
  });
});
