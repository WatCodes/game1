import type { GameState, Id, Num } from '../engine/types';
import { SAVE_VERSION, createInitialState } from '../engine/state';
import { reapplyPurchasedEffects } from '../engine/research';
import { buildSources } from '../content/sources';
import { buildMegaproject } from '../content/megaprojects';

const SAVE_KEY = 'kardashev:v1';

// Saves persist runtime state only — content (definitions, names, costs) is
// rehydrated from src/content so rebalancing never invalidates a save.
export interface SaveV1 {
  version: number;
  tier: number;
  power: Num;
  runPower: Num;
  rp: Num;
  kp: number;
  owned: Record<Id, number>;
  purchased: Id[];
  committed: Num;
  routePct: number;
  dispatchReadyAt: number;
  lastSaved: number;
  stats: { lifetimePower: Num; ascensions: number; startedAt: number };
}

export function serialize(s: GameState): SaveV1 {
  const owned: Record<Id, number> = {};
  for (const src of Object.values(s.sources)) if (src.owned > 0) owned[src.id] = src.owned;
  return {
    version: SAVE_VERSION,
    tier: s.tier,
    power: s.power,
    runPower: s.runPower,
    rp: s.rp,
    kp: s.kp,
    owned,
    purchased: Object.values(s.research).filter((n) => n.purchased).map((n) => n.id),
    committed: s.megaproject.committed,
    routePct: s.routePct,
    dispatchReadyAt: s.dispatchReadyAt,
    lastSaved: s.lastSaved,
    stats: { ...s.stats },
  };
}

/** Rebuild a full GameState from content + a validated save's runtime values. */
export function hydrate(save: SaveV1): GameState {
  const s = createInitialState(save.lastSaved);
  s.tier = save.tier;
  s.power = save.power;
  s.runPower = save.runPower;
  s.rp = save.rp;
  s.kp = save.kp;
  s.dispatchReadyAt = save.dispatchReadyAt;
  s.lastSaved = save.lastSaved;
  s.stats = { ...save.stats };
  if (save.tier !== 0) {
    s.sources = {};
    for (const src of buildSources(save.tier)) s.sources[src.id] = src;
    s.megaproject = buildMegaproject(save.tier);
  }
  for (const [id, count] of Object.entries(save.owned)) {
    const src = s.sources[id];
    if (src && typeof count === 'number' && count >= 0) src.owned = Math.floor(count);
  }
  for (const id of save.purchased) {
    const node = s.research[id];
    if (node) node.purchased = true;
  }
  s.megaproject.committed = Math.max(0, Math.min(save.committed, s.megaproject.totalCost));
  s.routePct = Math.max(0, Math.min(1, save.routePct));
  reapplyPurchasedEffects(s); // restore automation managers
  return s;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Upgrade chain for old saves — never break one silently. v0 (pre-release)
 * lacked stats/dispatch/routing; synthesize defaults.
 */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version > SAVE_VERSION) throw new Error(`Save version ${version} is newer than this build`);
  let save = raw;
  if (version < 1) {
    save = {
      ...save,
      version: 1,
      routePct: save.routePct ?? 0,
      dispatchReadyAt: save.dispatchReadyAt ?? 0,
      stats: save.stats ?? {
        lifetimePower: typeof save.runPower === 'number' ? save.runPower : 0,
        ascensions: 0,
        startedAt: typeof save.lastSaved === 'number' ? save.lastSaved : Date.now(),
      },
    };
  }
  return save;
}

/** Migrate then structurally validate — reject anything that would corrupt state. */
export function validateSave(raw: unknown): SaveV1 {
  if (!isRecord(raw)) throw new Error('Save is not an object');
  const m = migrate(raw);
  const numFields = ['tier', 'power', 'runPower', 'rp', 'kp', 'committed', 'routePct', 'lastSaved'] as const;
  for (const f of numFields) {
    if (typeof m[f] !== 'number' || !isFinite(m[f] as number)) throw new Error(`Save field "${f}" is invalid`);
  }
  if ((m.tier as number) < 0 || (m.power as number) < 0) throw new Error('Save contains negative values');
  if (!isRecord(m.owned)) throw new Error('Save field "owned" is invalid');
  if (!Array.isArray(m.purchased)) throw new Error('Save field "purchased" is invalid');
  if (!isRecord(m.stats)) throw new Error('Save field "stats" is invalid');
  return m as unknown as SaveV1;
}

export function saveToStorage(s: GameState, now: number = Date.now()): void {
  if (typeof localStorage === 'undefined') return;
  s.lastSaved = now;
  localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(s)));
}

export function loadFromStorage(): GameState | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return hydrate(validateSave(JSON.parse(raw)));
  } catch (err) {
    console.error('Failed to load save — starting fresh', err);
    return null;
  }
}

export function clearStorage(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SAVE_KEY);
}

/** Base64 backup string for copy-paste export/import. */
export function exportSave(s: GameState): string {
  return btoa(JSON.stringify(serialize(s)));
}

export function importSave(encoded: string): GameState {
  let json: string;
  try {
    json = atob(encoded.trim());
  } catch {
    throw new Error('Not a valid save string');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Save string is corrupted');
  }
  return hydrate(validateSave(parsed));
}
