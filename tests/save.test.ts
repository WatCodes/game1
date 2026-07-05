import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { buyResearch } from '../src/engine/research';
import { exportSave, hydrate, importSave, migrate, serialize, validateSave } from '../src/store/save';

function playedState() {
  const s = createInitialState(1000);
  s.power = 4321.5;
  s.runPower = 98765;
  s.rp = 1e9;
  s.kp = 7;
  s.sources['battery-bank'].owned = 42;
  buyResearch(s, 'unlock-coal-plant');
  buyResearch(s, 'auto-battery-bank');
  s.megaproject.committed = 12345;
  s.routePct = 0.35;
  s.lastSaved = 555_000;
  return s;
}

describe('round trip', () => {
  it('serialize → hydrate restores exact runtime state', () => {
    const s = playedState();
    const restored = hydrate(validateSave(JSON.parse(JSON.stringify(serialize(s)))));
    expect(restored.tier).toBe(s.tier);
    expect(restored.power).toBe(s.power);
    expect(restored.runPower).toBe(s.runPower);
    expect(restored.kp).toBe(s.kp);
    expect(restored.sources['battery-bank'].owned).toBe(42);
    expect(restored.sources['battery-bank'].automated).toBe(true); // via reapply
    expect(restored.research['unlock-coal-plant'].purchased).toBe(true);
    expect(restored.megaproject.committed).toBe(12345);
    expect(restored.routePct).toBe(0.35);
    expect(restored.lastSaved).toBe(555_000);
  });

  it('rebuilds the saved tier, not tier 0', () => {
    const save = serialize(playedState());
    save.tier = 2;
    save.owned = { 'fission-reactor': 3 };
    const restored = hydrate(validateSave(JSON.parse(JSON.stringify(save))));
    expect(restored.sources['fission-reactor'].owned).toBe(3);
    expect(restored.sources['battery-bank']).toBeUndefined();
    expect(restored.megaproject.id).toBe('planetary-fusion-grid');
  });

  it('drops unknown source/research ids after a rebalance', () => {
    const save = serialize(playedState());
    save.owned['removed-source'] = 99;
    save.purchased.push('removed-node');
    const restored = hydrate(validateSave(JSON.parse(JSON.stringify(save))));
    expect(restored.sources['removed-source']).toBeUndefined();
    expect(restored.research['removed-node']).toBeUndefined();
  });
});

describe('migration', () => {
  it('upgrades a v0 save with synthesized fields', () => {
    const v0 = {
      tier: 0,
      power: 100,
      runPower: 500,
      rp: 10,
      kp: 0,
      owned: { 'battery-bank': 5 },
      purchased: [],
      committed: 0,
      lastSaved: 42,
    };
    const migrated = validateSave(v0);
    expect(migrated.version).toBe(1);
    expect(migrated.routePct).toBe(0);
    expect(migrated.stats.lifetimePower).toBe(500);
    expect(migrated.stats.ascensions).toBe(0);
  });

  it('rejects saves from a newer build', () => {
    expect(() => migrate({ version: 99 })).toThrow(/newer/);
  });
});

describe('export / import', () => {
  it('round-trips through the base64 string', () => {
    const s = playedState();
    const restored = importSave(exportSave(s));
    expect(restored.sources['battery-bank'].owned).toBe(42);
    expect(restored.kp).toBe(7);
  });

  it('rejects garbage with a clear message', () => {
    expect(() => importSave('!!!not-base64!!!')).toThrow('Not a valid save string');
    expect(() => importSave(btoa('{"version":1,'))).toThrow('Save string is corrupted');
    expect(() => importSave(btoa('"just a string"'))).toThrow('Save is not an object');
    expect(() => importSave(btoa('{"version":1,"tier":"zero"}'))).toThrow(/invalid/);
  });

  it('rejects negative values that would corrupt state', () => {
    const save = serialize(playedState());
    (save as { power: number }).power = -5;
    expect(() => validateSave(save)).toThrow(/negative/);
  });
});
