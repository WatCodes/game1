import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, createInitialState } from '../src/engine/state';
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
  s.credits = 321;
  s.solvers = 2;
  s.solverProgress = 0.4;
  s.boosts.surgeLeft = 45;
  s.daily = { lastClaimDay: '2026-7-5', streak: 3 };
  s.achievements = ['first-spark', 'first-rack'];
  s.puzzle.tiles[0].rot = (s.puzzle.tiles[0].rot + 1) % 4;
  s.puzzle.moves = 5;
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
    expect(restored.credits).toBe(321);
    expect(restored.solvers).toBe(2);
    expect(restored.solverProgress).toBe(0.4);
    expect(restored.boosts.surgeLeft).toBe(45);
    expect(restored.daily).toEqual({ lastClaimDay: '2026-7-5', streak: 3 });
    expect(restored.achievements).toEqual(['first-spark', 'first-rack']);
    expect(restored.puzzle.tiles.map((t) => t.rot)).toEqual(s.puzzle.tiles.map((t) => t.rot));
    expect(restored.puzzle.moves).toBe(5);
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
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.routePct).toBe(0);
    expect(migrated.stats.lifetimePower).toBe(500);
    expect(migrated.stats.ascensions).toBe(0);
    expect(migrated.stats.puzzlesSolved).toBe(0);
    expect(migrated.dispatch).toEqual({ charge: 0, peakLeft: 0, nextPeakIn: 240 });
    expect(migrated.credits).toBe(0);
    expect(migrated.puzzle).toBeNull();
  });

  it('upgrades a v1 save: cooldown dispatch dropped, stages derived from progress', () => {
    const v1 = {
      version: 1,
      tier: 0,
      power: 100,
      runPower: 500,
      rp: 10,
      kp: 0,
      owned: {},
      purchased: [],
      committed: 210_000, // 60% of the old-style project
      routePct: 0.5,
      dispatchReadyAt: 12345,
      lastSaved: 42,
      stats: { lifetimePower: 500, ascensions: 0, startedAt: 42 },
    };
    const migrated = validateSave(v1);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect('dispatchReadyAt' in migrated).toBe(false);
    const restored = hydrate(migrated);
    // 210k / 350k = 60% → stages 1–3 worth of progress stays reachable
    expect(restored.megaproject.stagesAuthorized).toBe(4);
    expect(restored.megaproject.committed).toBe(210_000);
    // v3 additions get sane defaults, including a freshly dealt circuit
    expect(restored.credits).toBe(0);
    expect(restored.puzzle.tiles.length).toBe(restored.puzzle.size ** 2);
  });

  it('upgrades a v2 save: puzzle/shop economy seeded with defaults', () => {
    const v2 = {
      version: 2,
      tier: 1,
      power: 100,
      runPower: 500,
      rp: 10,
      kp: 3,
      owned: { 'solar-farm': 4 },
      purchased: [],
      committed: 0,
      stagesAuthorized: 1,
      routePct: 0,
      dispatch: { charge: 0.5, peakLeft: 0, nextPeakIn: 100 },
      lastSaved: 42,
      stats: { lifetimePower: 500, ascensions: 1, startedAt: 42 },
    };
    const restored = hydrate(validateSave(v2));
    expect(restored.credits).toBe(0);
    expect(restored.solvers).toBe(0);
    expect(restored.daily).toEqual({ lastClaimDay: '', streak: 0 });
    expect(restored.boosts).toEqual({ surgeLeft: 0, powerLeft: 0, rpLeft: 0 });
    expect(restored.puzzle.tier).toBe(1); // dealt for the saved tier
    expect(restored.sources['solar-farm'].owned).toBe(4);
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
