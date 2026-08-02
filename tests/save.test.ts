import { afterEach, describe, expect, it } from 'vitest';
import { SAVE_VERSION, createInitialState } from '../src/engine/state';
import { CONFIG } from '../src/content/config';
import { buyResearch } from '../src/engine/research';
import {
  backupInfo,
  exportSave,
  hasSaveFailed,
  hydrate,
  importSave,
  loadBackup,
  loadFromStorage,
  migrate,
  resetBackupCache,
  saveToStorage,
  serialize,
  validateSave,
} from '../src/store/save';

function playedState() {
  const s = createInitialState(1000);
  s.power = 4321.5;
  s.runPower = 98765;
  s.rp = 1e9;
  s.kp = 7;
  s.sources['battery-bank'].owned = 42;
  buyResearch(s, 'unlock-coal-plant');
  buyResearch(s, 'auto-battery-bank');
  s.sources['battery-bank'].autoPaused = true;
  s.megaproject.committed = 12345;
  s.routePct = 0.35;
  s.sellPct = 0.5; // 0.5 + 0.35 = 0.85 ≤ 1
  s.market.saturation = 1.2;
  s.credits = 321;
  s.solvers = 2;
  s.solverProgress = 0.4;
  s.boosts.surgeLeft = 45;
  s.daily = { lastClaimDay: '2026-7-5', streak: 3 };
  s.achievements = ['first-spark', 'first-rack'];
  s.grid = { vLevel: 2, aLevel: 1, rLevel: 1 };
  s.launchWindow = { active: true, timeLeft: 12, nextIn: 0 };
  s.accretion = { feedRate: 0.6, heat: 0.3 };
  s.relay = { researchAllocation: 0.25 };
  // Dirty a blank feeder so the round trip has a partly-filled board to carry.
  const blank = s.puzzle.givens.findIndex((g) => !g);
  s.puzzle.cells[blank] = 1;
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
    expect(restored.sources['battery-bank'].autoPaused).toBe(true); // player's pause survives reload
    expect(restored.research['unlock-coal-plant'].purchased).toBe(true);
    expect(restored.megaproject.committed).toBe(12345);
    expect(restored.routePct).toBe(0.35);
    expect(restored.sellPct).toBe(0.5);
    expect(restored.market.saturation).toBeCloseTo(1.2);
    expect(restored.lastSaved).toBe(555_000);
    expect(restored.credits).toBe(321);
    expect(restored.solvers).toBe(2);
    expect(restored.solverProgress).toBe(0.4);
    expect(restored.boosts.surgeLeft).toBe(45);
    expect(restored.daily).toEqual({ lastClaimDay: '2026-7-5', streak: 3 });
    expect(restored.achievements).toEqual(['first-spark', 'first-rack']);
    expect(restored.grid).toEqual({ vLevel: 2, aLevel: 1, rLevel: 1 });
    expect(restored.launchWindow).toEqual({ active: true, timeLeft: 12, nextIn: 0 });
    expect(restored.accretion).toEqual({ feedRate: 0.6, heat: 0.3 });
    expect(restored.relay).toEqual({ researchAllocation: 0.25 });
    expect(restored.puzzle.cells).toEqual(s.puzzle.cells);
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
    // v7: the old 100 W bank converts to CR and the Watt bank retires to 0
    expect(migrated.credits).toBe(100 * CONFIG.BASE_PRICE);
    expect(migrated.power).toBe(0);
    expect(migrated.sellPct).toBeCloseTo(0.6);
    expect(migrated.puzzle).toBeNull();
  });

  it('upgrades a v7 save without disturbing a run in progress (v8: demand index)', () => {
    // A realistic live v7 save — the shape real players are on today.
    const v7 = {
      version: 7,
      tier: 2,
      power: 0,
      runPower: 5e6,
      rp: 900,
      kp: 12,
      owned: { 'fission-reactor': 40 },
      purchased: [],
      committed: 1234,
      stagesAuthorized: 2,
      routePct: 0.25,
      sellPct: 0.5,
      market: { saturation: 0.8 },
      dispatch: { charge: 0.5, peakLeft: 0, nextPeakIn: 100 },
      grid: { vLevel: 2, aLevel: 3, rLevel: 1 },
      credits: 5000,
      solvers: 2,
      solverProgress: 0.3,
      launchWindow: { active: false, timeLeft: 0, nextIn: 90 },
      accretion: { feedRate: 0, heat: 0 },
      relay: { researchAllocation: 0 },
      boosts: { surgeLeft: 0, powerLeft: 0, rpLeft: 0 },
      daily: { lastClaimDay: '', streak: 0 },
      achievements: [],
      puzzle: null,
      lastSaved: 42,
      stats: { lifetimePower: 9e6, ascensions: 2, startedAt: 0, puzzlesSolved: 7 },
    };
    const m = validateSave(v7);
    expect(m.version).toBe(SAVE_VERSION);
    // The new market half defaults to neutral, so nobody's income silently moves.
    expect(m.market.index).toBe(CONFIG.INDEX_MEAN);
    // Everything the player actually earned is untouched.
    expect(m.market.saturation).toBe(0.8);
    expect(m.credits).toBe(5000);
    expect(m.kp).toBe(12);
    expect(m.grid).toEqual({ vLevel: 2, aLevel: 3, rLevel: 1 });
    expect(m.stats.lifetimePower).toBe(9e6);

    const s = hydrate(m);
    expect(s.market.index).toBe(CONFIG.INDEX_MEAN);
    expect(s.market.indexHistory).toEqual([]);
    expect(s.reserve).toEqual({ stored: 0, avgPrice: 0 });
    expect(s.credits).toBe(5000);
  });

  it('refunds a futures stake left open when the wager mechanic was removed (v8→v9)', () => {
    // The Futures Desk shipped briefly and became the Arbitrage Desk. A stake is
    // deducted on placing, so settling a bet whose rules no longer exist would be
    // arbitrary — the player gets their Credits back instead.
    const save = JSON.parse(JSON.stringify(serialize(playedState()))) as Record<string, unknown>;
    const before = save.credits as number;
    const m = validateSave({
      ...save,
      version: 8,
      futures: { stake: 250, up: true, entryIndex: 1, secondsLeft: 20 },
    });
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.credits).toBe(before + 250);
    expect(hydrate(m).reserve).toEqual({ stored: 0, avgPrice: 0 });
  });

  it('ignores a malformed futures remnant instead of refunding garbage', () => {
    const save = JSON.parse(JSON.stringify(serialize(playedState()))) as Record<string, unknown>;
    const before = save.credits as number;
    const m = validateSave({ ...save, version: 8, futures: { stake: 'lots', up: 'yes' } });
    expect(m.credits).toBe(before);
  });

  it('refuses to trust a doctored reserve', () => {
    const save = JSON.parse(JSON.stringify(serialize(playedState()))) as Record<string, unknown>;
    const s = hydrate(validateSave({ ...save, reserve: { stored: 'plenty', avgPrice: -5 } }));
    expect(s.reserve).toEqual({ stored: 0, avgPrice: 0 });
    // Stored Watts with a nonsense basis are kept but treated as free, never as
    // a credit-minting negative cost.
    const s2 = hydrate(validateSave({ ...save, reserve: { stored: 100, avgPrice: -5 } }));
    expect(s2.reserve.avgPrice).toBe(0);
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
    // v3 additions get sane defaults, including a freshly dealt board
    expect(restored.credits).toBe(100 * CONFIG.BASE_PRICE); // v7 power→CR
    expect(restored.puzzle.cells.length).toBe(restored.puzzle.size ** 2);
  });

  it('discards a Lights Out board and deals a fresh one, keeping everything else', () => {
    // A save written before Feeder Balance: same SAVE_VERSION, but the board
    // carries the old shape (boolean cells, no givens or clue arrays). There is
    // no migration for this by design — the validator rejects it and hydrate
    // deals fresh, which is why a mechanic swap needs no version bump.
    const s = playedState();
    const save = JSON.parse(JSON.stringify(serialize(s))) as Record<string, unknown>;
    save.puzzle = {
      tier: 0,
      size: 4,
      cells: new Array(16).fill(false), // booleans, not load levels
      moves: 9,
      par: 4,
      solved: false,
    };

    const restored = hydrate(validateSave(save));

    // The board is replaced wholesale...
    expect(restored.puzzle.cells.every((c) => typeof c === 'number')).toBe(true);
    expect(restored.puzzle.givens).toHaveLength(restored.puzzle.size ** 2);
    expect(restored.puzzle.across).toHaveLength(restored.puzzle.size * (restored.puzzle.size - 1));
    expect(restored.puzzle.moves).toBe(0); // not the stale 9
    // ...and nothing else in the save is collateral damage.
    expect(restored.credits).toBe(s.credits);
    expect(restored.solvers).toBe(s.solvers);
    expect(restored.stats.puzzlesSolved).toBe(s.stats.puzzlesSolved);
    expect(restored.daily).toEqual({ lastClaimDay: '2026-7-5', streak: 3 });
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
    expect(restored.grid.vLevel).toBeGreaterThanOrEqual(0); // sentinel resolved
    expect(restored.credits).toBe(100 * CONFIG.BASE_PRICE); // v7 power→CR
    expect(restored.solvers).toBe(0);
    expect(restored.daily).toEqual({ lastClaimDay: '', streak: 0 });
    expect(restored.boosts).toEqual({ surgeLeft: 0, powerLeft: 0, rpLeft: 0 });
    expect(restored.puzzle.tier).toBe(1); // dealt for the saved tier
    expect(restored.sources['solar-farm'].owned).toBe(4);
  });

  it('upgrades a v5 save: tier twists seeded with defaults', () => {
    const v5 = {
      version: 5,
      tier: 3,
      power: 100,
      runPower: 500,
      rp: 10,
      kp: 3,
      owned: {},
      purchased: [],
      committed: 0,
      stagesAuthorized: 1,
      routePct: 0,
      dispatch: { charge: 0, peakLeft: 0, nextPeakIn: 100 },
      grid: { vLevel: 1, aLevel: 0, rLevel: 0 },
      credits: 50,
      puzzle: null,
      solvers: 0,
      solverProgress: 0,
      boosts: { surgeLeft: 0, powerLeft: 0, rpLeft: 0 },
      daily: { lastClaimDay: '', streak: 0 },
      achievements: [],
      lastSaved: 42,
      stats: { lifetimePower: 500, ascensions: 3, startedAt: 42, puzzlesSolved: 0 },
    };
    const restored = hydrate(validateSave(v5));
    expect(restored.launchWindow).toEqual({ active: false, timeLeft: 0, nextIn: expect.any(Number) });
    expect(restored.accretion).toEqual({ feedRate: 0, heat: 0 });
    expect(restored.relay).toEqual({ researchAllocation: 0 });
    expect(restored.grid.vLevel).toBe(1); // untouched by this migration step
  });

  it('upgrades a v6 save: the Watt bank converts to CR and the sell rail seeds', () => {
    const s = playedState();
    s.power = 500;
    s.credits = 100;
    s.routePct = 0.7; // leaves ≤0.3 for the sell rail
    const save = serialize(s) as unknown as Record<string, unknown>;
    save.version = 6;
    delete save.sellPct;
    delete save.market;
    const restored = hydrate(validateSave(save));
    // banked Watts (500) fold into CR at BASE_PRICE, on top of existing 100 CR
    expect(restored.credits).toBeCloseTo(100 + 500 * CONFIG.BASE_PRICE);
    expect(restored.power).toBe(0); // Watt bank retired
    expect(restored.sellPct).toBeCloseTo(0.3); // default 0.6 clamped by route 0.7
    expect(restored.market.saturation).toBe(0);
  });

  it('grandfathers an in-flight project: a save without a stored cost keeps the base price', () => {
    const s = playedState();
    s.kp = 1_000_000; // enough prestige that re-pricing would explode the build
    const save = serialize(s) as unknown as Record<string, unknown>;
    const basePrice = save.megaTotalCost as number;
    delete save.megaTotalCost; // as an older save would be
    const restored = hydrate(validateSave(save));
    expect(restored.megaproject.totalCost).toBeCloseTo(basePrice);
    expect(restored.megaproject.committed).toBe(12345); // progress intact
  });

  it('a stored project cost survives the round trip', () => {
    const s = playedState();
    s.megaproject.totalCost = 987_654_321;
    const restored = hydrate(validateSave(JSON.parse(JSON.stringify(serialize(s)))));
    expect(restored.megaproject.totalCost).toBe(987_654_321);
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

describe('rolling backup', () => {
  // Node has no localStorage — shim one for the storage layer
  function installStorage() {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    resetBackupCache();
    return store;
  }

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).localStorage;
    resetBackupCache();
  });

  it('tracks the main save while progress rises', () => {
    installStorage();
    const s = playedState();
    saveToStorage(s, 1000);
    expect(backupInfo()?.lifetimePower).toBe(s.stats.lifetimePower);
  });

  it('a lower-progress state never clobbers the backup (wipe protection)', () => {
    installStorage();
    const progressed = playedState();
    progressed.stats.lifetimePower = 5e10;
    saveToStorage(progressed, 1000);
    // simulate the bug class we hit: a fresh state autosaving over everything
    const fresh = createInitialState(2000);
    saveToStorage(fresh, 2000);
    // main save is fresh, but the backup still holds the progressed run
    expect(backupInfo()?.lifetimePower).toBe(5e10);
    const recovered = loadBackup();
    expect(recovered).not.toBeNull();
    expect(recovered!.stats.lifetimePower).toBe(5e10);
    expect(recovered!.sources['battery-bank'].owned).toBe(42);
  });
});

/**
 * Storage that refuses writes is not hypothetical on a phone: the quota fills,
 * or the WebView reports storage it won't actually persist to. The rule is that
 * this degrades loudly and never takes the game down with it.
 */
describe('storage failure', () => {
  /** A Storage shim with a working enumeration API and a settable write fault. */
  function installStorage(opts: { failWrites?: boolean } = {}) {
    const store = new Map<string, string>();
    const api = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (api.failWrites) throw new DOMException('quota', 'QuotaExceededError');
        store.set(k, v);
      },
      removeItem: (k: string) => void store.delete(k),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
      failWrites: !!opts.failWrites,
    };
    (globalThis as Record<string, unknown>).localStorage = api;
    resetBackupCache();
    return { store, api };
  }

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).localStorage;
    resetBackupCache();
  });

  it('a full quota reports failure instead of throwing', () => {
    const { api } = installStorage({ failWrites: true });
    const s = playedState();
    expect(() => saveToStorage(s, 1000)).not.toThrow();
    expect(saveToStorage(s, 1000)).toBe(false);
    expect(hasSaveFailed()).toBe(true);
    // ...and recovers once there's room again, so the warning isn't permanent.
    api.failWrites = false;
    expect(saveToStorage(s, 2000)).toBe(true);
    expect(hasSaveFailed()).toBe(false);
  });

  it('a failed backup write is retried rather than remembered as done', () => {
    const { api } = installStorage();
    const s = playedState();
    s.stats.lifetimePower = 5e10;
    api.failWrites = true;
    saveToStorage(s, 1000);
    expect(backupInfo()).toBeNull(); // nothing landed
    api.failWrites = false;
    saveToStorage(s, 2000);
    // The watermark must not have advanced past a write that never happened.
    expect(backupInfo()?.lifetimePower).toBe(5e10);
  });

  it('recovery snapshots are capped, not accumulated forever', () => {
    const { store } = installStorage();
    // A load failure that recurs on every launch used to write an unbounded
    // pile of full save copies — a slow leak that eventually breaks the saves
    // that DO work.
    for (let i = 0; i < 8; i++) {
      store.set('kardashev:v1', '{"not":"a valid save"');
      loadFromStorage();
    }
    const recovery = [...store.keys()].filter((k) => k.startsWith('kardashev:recovery:'));
    expect(recovery.length).toBeLessThanOrEqual(3);
    expect(recovery.length).toBeGreaterThan(0); // still rescuable by hand
  });
});
