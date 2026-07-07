import type { GameState, Id, Num, PuzzleState } from '../engine/types';
import { SAVE_VERSION, createInitialState } from '../engine/state';
import { reapplyPurchasedEffects } from '../engine/research';
import { isSolved, newPuzzle, puzzleSize } from '../engine/puzzle';
import { generationPerSec } from '../engine/economy';
import { transmissionCap } from '../engine/grid';
import { buildSources } from '../content/sources';
import { buildMegaproject } from '../content/megaprojects';
import { ACHIEVEMENTS } from '../content/achievements';

const SAVE_KEY = 'kardashev:v1';

// Saves persist runtime state only — content (definitions, names, costs) is
// rehydrated from src/content so rebalancing never invalidates a save.
export interface SaveData {
  version: number;
  tier: number;
  power: Num;
  runPower: Num;
  rp: Num;
  kp: number;
  owned: Record<Id, number>;
  purchased: Id[];
  committed: Num;
  stagesAuthorized: number;
  routePct: number;
  dispatch: { charge: number; peakLeft: number; nextPeakIn: number };
  grid: { vLevel: number; aLevel: number; rLevel: number };
  credits: number;
  puzzle: PuzzleState | null; // null → deal a fresh circuit on load
  solvers: number;
  solverProgress: number;
  boosts: { surgeLeft: number; powerLeft: number; rpLeft: number };
  daily: { lastClaimDay: string; streak: number };
  achievements: Id[];
  lastSaved: number;
  stats: { lifetimePower: Num; ascensions: number; startedAt: number; puzzlesSolved: number };
}

export function serialize(s: GameState): SaveData {
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
    stagesAuthorized: s.megaproject.stagesAuthorized,
    routePct: s.routePct,
    dispatch: { ...s.dispatch },
    grid: { ...s.grid },
    credits: s.credits,
    puzzle: { ...s.puzzle, tiles: s.puzzle.tiles.map((t) => ({ ...t })) },
    solvers: s.solvers,
    solverProgress: s.solverProgress,
    boosts: { ...s.boosts },
    daily: { ...s.daily },
    achievements: [...s.achievements],
    lastSaved: s.lastSaved,
    stats: { ...s.stats },
  };
}

const TILE_KINDS = new Set(['stub', 'straight', 'corner', 'tee', 'cross']);
const TILE_ROLES = new Set(['source', 'sink', 'wire']);

/** A saved puzzle must be structurally sound or we deal a fresh one. */
function isValidPuzzle(p: PuzzleState | null | undefined, tier: number): p is PuzzleState {
  if (!p || typeof p.size !== 'number' || !Array.isArray(p.tiles)) return false;
  if (p.size !== puzzleSize(tier) || p.tiles.length !== p.size * p.size) return false;
  return p.tiles.every(
    (t) => t && TILE_KINDS.has(t.kind) && TILE_ROLES.has(t.role) && typeof t.rot === 'number',
  );
}

/** Rebuild a full GameState from content + a validated save's runtime values. */
export function hydrate(save: SaveData): GameState {
  const s = createInitialState(save.lastSaved);
  s.tier = save.tier;
  s.power = save.power;
  s.runPower = save.runPower;
  s.rp = save.rp;
  s.kp = save.kp;
  s.dispatch = {
    charge: Math.max(0, Math.min(1, save.dispatch.charge)),
    peakLeft: Math.max(0, save.dispatch.peakLeft),
    nextPeakIn: Math.max(0, save.dispatch.nextPeakIn),
  };
  s.grid = {
    vLevel: Math.floor(save.grid?.vLevel ?? 0),
    aLevel: Math.max(0, Math.floor(save.grid?.aLevel ?? 0)),
    rLevel: Math.max(0, Math.floor(save.grid?.rLevel ?? 0)),
  };
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
  const n = s.megaproject.stages.length;
  // stagesAuthorized < 0 = "derive from progress" sentinel set by the v1→v2
  // migration, which had no way to know the project's totalCost.
  s.megaproject.stagesAuthorized =
    save.stagesAuthorized >= 0
      ? Math.max(1, Math.min(n, Math.floor(save.stagesAuthorized)))
      : Math.max(1, Math.min(n, Math.floor((save.committed / s.megaproject.totalCost) * n) + 1));
  s.megaproject.committed = Math.max(0, Math.min(save.committed, s.megaproject.totalCost));
  s.routePct = Math.max(0, Math.min(1, save.routePct));
  s.credits = Math.max(0, save.credits);
  s.solvers = Math.max(0, Math.floor(save.solvers));
  s.solverProgress = Math.max(0, save.solverProgress);
  s.boosts = {
    surgeLeft: Math.max(0, save.boosts?.surgeLeft ?? 0),
    powerLeft: Math.max(0, save.boosts?.powerLeft ?? 0),
    rpLeft: Math.max(0, save.boosts?.rpLeft ?? 0),
  };
  s.daily = {
    lastClaimDay: typeof save.daily?.lastClaimDay === 'string' ? save.daily.lastClaimDay : '',
    streak: Math.max(0, Math.floor(save.daily?.streak ?? 0)),
  };
  const knownAchievements = new Set(ACHIEVEMENTS.map((a) => a.id));
  s.achievements = save.achievements.filter((id) => knownAchievements.has(id));
  if (isValidPuzzle(save.puzzle, save.tier)) {
    s.puzzle = {
      tier: save.tier,
      size: save.puzzle.size,
      tiles: save.puzzle.tiles.map((t) => ({ kind: t.kind, rot: ((t.rot % 4) + 4) % 4, role: t.role })),
      moves: Math.max(0, Math.floor(save.puzzle.moves ?? 0)),
      par: Math.max(0, Math.floor(save.puzzle.par ?? 0)),
      solved: !!save.puzzle.solved,
    };
    // never trust the latch blindly — recompute so a stale flag can't farm
    s.puzzle.solved = s.puzzle.solved && isSolved(s.puzzle);
  } else {
    s.puzzle = newPuzzle(save.tier);
  }
  reapplyPurchasedEffects(s); // restore automation managers
  if (s.grid.vLevel < 0) {
    // grandfather sentinel from the v4→v5 migration (see migrate)
    s.grid.vLevel = 0;
    const gen = generationPerSec(s);
    while (transmissionCap(s) < gen && s.grid.vLevel < 99) s.grid.vLevel += 1;
  }
  return s;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Upgrade chain for old saves — never break one silently. v0 (pre-release)
 * lacked stats/routing; v1 had a cooldown-based dispatch and no stage
 * authorization. Synthesize defaults at each step.
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
      stats: save.stats ?? {
        lifetimePower: typeof save.runPower === 'number' ? save.runPower : 0,
        ascensions: 0,
        startedAt: typeof save.lastSaved === 'number' ? save.lastSaved : Date.now(),
      },
    };
  }
  if ((save.version as number) < 2) {
    const rest = { ...save };
    delete rest.dispatchReadyAt; // v1's cooldown model is gone
    save = {
      ...rest,
      version: 2,
      dispatch: { charge: 0, peakLeft: 0, nextPeakIn: 240 },
      stagesAuthorized: -1, // sentinel: hydrate derives it from committed progress
    };
  }
  if ((save.version as number) < 3) {
    const stats = isRecord(save.stats) ? save.stats : {};
    save = {
      ...save,
      version: 3,
      credits: 0,
      puzzle: null, // hydrate deals a fresh circuit
      solvers: 0,
      solverProgress: 0,
      boosts: { surgeLeft: 0, powerLeft: 0, rpLeft: 0 },
      daily: { lastClaimDay: '', streak: 0 },
      stats: { ...stats, puzzlesSolved: 0 },
    };
  }
  if ((save.version as number) < 4) {
    save = { ...save, version: 4, achievements: [] };
  }
  // Keyed on the field, not just the version: a half-updated client once wrote
  // a "v5" save without grid, and version-only gating rejected it.
  if ((save.version as number) < 5 || !isRecord(save.grid)) {
    // vLevel −1 = "grandfather" sentinel: hydrate fits enough transformer
    // levels to carry the run's current generation, so the new transmission
    // mechanic pressures future growth instead of kneecapping an old run.
    save = { ...save, version: 5, grid: { vLevel: -1, aLevel: 0, rLevel: 0 } };
  }
  return save;
}

/** Migrate then structurally validate — reject anything that would corrupt state. */
export function validateSave(raw: unknown): SaveData {
  if (!isRecord(raw)) throw new Error('Save is not an object');
  const m = migrate(raw);
  const numFields = [
    'tier', 'power', 'runPower', 'rp', 'kp', 'committed', 'stagesAuthorized',
    'routePct', 'lastSaved', 'credits', 'solvers', 'solverProgress',
  ] as const;
  for (const f of numFields) {
    if (typeof m[f] !== 'number' || !isFinite(m[f] as number)) throw new Error(`Save field "${f}" is invalid`);
  }
  if ((m.tier as number) < 0 || (m.power as number) < 0) throw new Error('Save contains negative values');
  if (!isRecord(m.owned)) throw new Error('Save field "owned" is invalid');
  if (!Array.isArray(m.purchased)) throw new Error('Save field "purchased" is invalid');
  if (!isRecord(m.stats)) throw new Error('Save field "stats" is invalid');
  if (!isRecord(m.dispatch)) throw new Error('Save field "dispatch" is invalid');
  if (!isRecord(m.grid)) throw new Error('Save field "grid" is invalid');
  if (!isRecord(m.boosts)) throw new Error('Save field "boosts" is invalid');
  if (!isRecord(m.daily)) throw new Error('Save field "daily" is invalid');
  if (!Array.isArray(m.achievements)) throw new Error('Save field "achievements" is invalid');
  return m as unknown as SaveData;
}

const BACKUP_KEY = 'kardashev:backup';
let backupLifetime = -1; // lazily learned from storage on first save

export function saveToStorage(s: GameState, now: number = Date.now()): void {
  if (typeof localStorage === 'undefined') return;
  s.lastSaved = now;
  localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(s)));
  maybeBackup(s);
}

/**
 * Rolling second save with a monotonic guard: a state with LESS lifetime
 * power than the backup never overwrites it. If a code bug ever wipes the
 * main save to a fresh state again, the backup survives indefinitely.
 */
function maybeBackup(s: GameState): void {
  if (backupLifetime < 0) {
    backupLifetime = backupInfo()?.lifetimePower ?? 0;
  }
  if (s.stats.lifetimePower >= backupLifetime) {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(serialize(s)));
    backupLifetime = s.stats.lifetimePower;
  }
}

export function backupInfo(): { lastSaved: number; lifetimePower: Num } | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(BACKUP_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SaveData;
    return { lastSaved: parsed.lastSaved ?? 0, lifetimePower: parsed.stats?.lifetimePower ?? 0 };
  } catch {
    return null;
  }
}

export function loadBackup(): GameState | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(BACKUP_KEY);
  if (!raw) return null;
  try {
    return hydrate(validateSave(JSON.parse(raw)));
  } catch (err) {
    console.error('Backup failed to load', err);
    return null;
  }
}

/** Test seam: forget the cached backup watermark. */
export function resetBackupCache(): void {
  backupLifetime = -1;
}

const RECOVERY_KEY = 'kardashev:recovery';

export function loadFromStorage(): GameState | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return hydrate(validateSave(JSON.parse(raw)));
  } catch (err) {
    // NEVER lose a save to a load bug: stash the raw payload so it can be
    // recovered (import it, or a fixed build can re-read it), then start fresh.
    console.error('Failed to load save — preserved under kardashev:recovery', err);
    try {
      localStorage.setItem(`${RECOVERY_KEY}:${Date.now()}`, raw);
    } catch {
      /* storage full — nothing more we can do */
    }
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
