import type { FuturesPosition, GameState, Id, Num, PuzzleState } from '../engine/types';
import { CONFIG } from '../content/config';
import { SAVE_VERSION, createInitialState } from '../engine/state';
import { reapplyPurchasedEffects } from '../engine/research';
import { isSolved, newPuzzle, puzzleSize } from '../engine/puzzle';
import { generationPerSec } from '../engine/economy';
import { stagesCompleted } from '../engine/megaproject';
import { transmissionCap } from '../engine/grid';
import { defaultTierTwistState } from '../engine/tierTwists';
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
  autoPaused?: Id[]; // managers the player toggled off (optional: absence = none paused)
  purchased: Id[];
  committed: Num;
  stagesAuthorized: number;
  // The project's cost is stored, not recomputed, so a rebalance (or the
  // prestige scaling added in §3.17) never re-prices a build already underway.
  // Absent on older saves → they keep the un-scaled cost they started with.
  megaTotalCost?: Num;
  decommissionedStages?: number; // absent on pre-v7 saves → grandfathered on load
  routePct: number; // Project rail share (0..1)
  sellPct: number; // Sell rail share (0..1); sellPct + routePct ≤ 1
  // `index`/`indexHistory`/`sampleIn` and `futures` arrive in v8; both are
  // optional so a v7 save hydrates with a neutral market and no open position.
  market: { saturation: number; index?: number; indexHistory?: number[]; sampleIn?: number };
  futures?: FuturesPosition | null;
  dispatch: { charge: number; peakLeft: number; nextPeakIn: number };
  grid: { vLevel: number; aLevel: number; rLevel: number };
  launchWindow: { active: boolean; timeLeft: number; nextIn: number };
  accretion: { feedRate: number; heat: number };
  relay: { researchAllocation: number };
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

const clampIndex = (n: number): number =>
  Math.max(CONFIG.INDEX_MIN, Math.min(CONFIG.INDEX_MAX, Number.isFinite(n) ? n : CONFIG.INDEX_MEAN));

/**
 * An open futures position is money already spent, so a malformed or hostile one
 * must never be able to mint Credits: every field is bounded, and anything that
 * doesn't parse is dropped entirely (the stake is simply forfeit rather than
 * settling for an arbitrary payout).
 */
function hydrateFutures(raw: unknown): FuturesPosition | null {
  if (!isRecord(raw)) return null;
  const { stake, up, entryIndex, secondsLeft } = raw as Record<string, unknown>;
  if (typeof stake !== 'number' || !Number.isFinite(stake) || stake <= 0) return null;
  if (typeof up !== 'boolean') return null;
  if (typeof entryIndex !== 'number' || !Number.isFinite(entryIndex)) return null;
  if (typeof secondsLeft !== 'number' || !Number.isFinite(secondsLeft)) return null;
  return {
    stake: Math.floor(stake),
    up,
    entryIndex: clampIndex(entryIndex),
    // Clamp the window so a doctored save can't hold a position open forever.
    secondsLeft: Math.max(0, Math.min(CONFIG.FUTURES_WINDOW_SECONDS, secondsLeft)),
  };
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
    autoPaused: Object.values(s.sources).filter((src) => src.autoPaused).map((src) => src.id),
    purchased: Object.values(s.research).filter((n) => n.purchased).map((n) => n.id),
    committed: s.megaproject.committed,
    stagesAuthorized: s.megaproject.stagesAuthorized,
    megaTotalCost: s.megaproject.totalCost,
    decommissionedStages: s.megaproject.decommissionedStages,
    routePct: s.routePct,
    sellPct: s.sellPct,
    market: { ...s.market, indexHistory: [...s.market.indexHistory] },
    futures: s.futures ? { ...s.futures } : null,
    dispatch: { ...s.dispatch },
    grid: { ...s.grid },
    launchWindow: { ...s.launchWindow },
    accretion: { ...s.accretion },
    relay: { ...s.relay },
    credits: s.credits,
    puzzle: { ...s.puzzle, cells: [...s.puzzle.cells] },
    solvers: s.solvers,
    solverProgress: s.solverProgress,
    boosts: { ...s.boosts },
    daily: { ...s.daily },
    achievements: [...s.achievements],
    lastSaved: s.lastSaved,
    stats: { ...s.stats },
  };
}

/** A saved board must be structurally sound or we deal a fresh one. */
function isValidPuzzle(p: PuzzleState | null | undefined, tier: number): p is PuzzleState {
  if (!p || typeof p.size !== 'number' || !Array.isArray(p.cells)) return false;
  if (p.size !== puzzleSize(tier) || p.cells.length !== p.size * p.size) return false;
  return p.cells.every((c) => typeof c === 'boolean');
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
  s.launchWindow = {
    active: !!save.launchWindow?.active,
    timeLeft: Math.max(0, save.launchWindow?.timeLeft ?? 0),
    nextIn: Math.max(0, save.launchWindow?.nextIn ?? CONFIG.LAUNCH_GAP_MIN_SECONDS),
  };
  s.accretion = {
    feedRate: Math.max(0, Math.min(1, save.accretion?.feedRate ?? 0)),
    heat: Math.max(0, Math.min(1, save.accretion?.heat ?? 0)),
  };
  s.relay = {
    researchAllocation: Math.max(0, Math.min(1, save.relay?.researchAllocation ?? 0)),
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
  // Restore the stored cost first — the stage/committed clamps below read it.
  // Missing (older save) = keep the freshly built base cost, i.e. grandfathered
  // at the price the run started at.
  if (typeof save.megaTotalCost === 'number' && isFinite(save.megaTotalCost) && save.megaTotalCost > 0) {
    s.megaproject.totalCost = save.megaTotalCost;
  }
  const n = s.megaproject.stages.length;
  // stagesAuthorized < 0 = "derive from progress" sentinel set by the v1→v2
  // migration, which had no way to know the project's totalCost.
  s.megaproject.stagesAuthorized =
    save.stagesAuthorized >= 0
      ? Math.max(1, Math.min(n, Math.floor(save.stagesAuthorized)))
      : Math.max(1, Math.min(n, Math.floor((save.committed / s.megaproject.totalCost) * n) + 1));
  s.megaproject.committed = Math.max(0, Math.min(save.committed, s.megaproject.totalCost));
  // Grandfather old saves: assume already-completed stages were paid, so loading
  // never retroactively dismantles an existing fleet.
  s.megaproject.decommissionedStages =
    typeof save.decommissionedStages === 'number'
      ? Math.max(0, Math.min(s.megaproject.stages.length, Math.floor(save.decommissionedStages)))
      : stagesCompleted(s);
  s.routePct = Math.max(0, Math.min(1, save.routePct));
  s.sellPct = Math.max(0, Math.min(1, save.sellPct ?? 0.6));
  // Enforce the rail invariant: Sell + Project can't exceed 100% of generation.
  if (s.sellPct + s.routePct > 1) s.sellPct = Math.max(0, 1 - s.routePct);
  const rawIndex = save.market?.index;
  s.market = {
    saturation: Math.max(0, save.market?.saturation ?? 0),
    // A pre-v8 save has no index; a neutral 1 is the honest default, and the
    // walk re-diverges within a few seconds of play.
    index: clampIndex(typeof rawIndex === 'number' ? rawIndex : CONFIG.INDEX_MEAN),
    indexHistory: Array.isArray(save.market?.indexHistory)
      ? save.market.indexHistory.filter((n) => typeof n === 'number' && Number.isFinite(n)).map(clampIndex).slice(-CONFIG.INDEX_HISTORY)
      : [],
    sampleIn: Math.max(0, save.market?.sampleIn ?? 0),
  };
  s.futures = hydrateFutures(save.futures);
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
      cells: save.puzzle.cells.map((c) => !!c),
      moves: Math.max(0, Math.floor(save.puzzle.moves ?? 0)),
      par: Math.max(1, Math.floor(save.puzzle.par ?? 1)),
      solved: !!save.puzzle.solved,
    };
    // never trust the latch blindly — recompute so a stale flag can't farm
    s.puzzle.solved = s.puzzle.solved && isSolved(s.puzzle);
  } else {
    // Includes old circuit-puzzle saves (tiles, no cells) — deal a fresh board.
    s.puzzle = newPuzzle(save.tier);
  }
  reapplyPurchasedEffects(s); // restore automation managers
  if (Array.isArray(save.autoPaused)) {
    for (const id of save.autoPaused) {
      const src = s.sources[id];
      if (src) src.autoPaused = true;
    }
  }
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
  if ((save.version as number) < 6 || !isRecord(save.launchWindow)) {
    save = { ...save, version: 6, ...defaultTierTwistState() };
  }
  // v7 — Dispatch Board. Power stops being the spend currency; CR is. The old
  // banked Watts convert to CR at BASE_PRICE so no value is lost, and the Watt
  // bank is retired to 0. Seed the Sell rail (default 0.6, clamped so it never
  // pushes Sell + Project over 100%); a fresh market starts unsaturated.
  if ((save.version as number) < 7 || typeof save.sellPct !== 'number' || !isRecord(save.market)) {
    const oldPower = typeof save.power === 'number' ? Math.max(0, save.power) : 0;
    const oldCredits = typeof save.credits === 'number' ? Math.max(0, save.credits) : 0;
    const routePct = typeof save.routePct === 'number' ? Math.max(0, Math.min(1, save.routePct)) : 0;
    save = {
      ...save,
      version: 7,
      power: 0,
      credits: oldCredits + oldPower * CONFIG.BASE_PRICE,
      sellPct: Math.max(0, Math.min(1 - routePct, 0.6)),
      market: { saturation: 0 },
    };
  }
  // v8 — the demand index and the Futures Desk. Purely additive: hydrate
  // defaults a missing index to neutral and a missing position to none, so this
  // only needs to stamp the version. Keyed on the field as well as the version,
  // for the same reason as v5 above.
  if ((save.version as number) < 8 || typeof (save.market as { index?: unknown })?.index !== 'number') {
    save = {
      ...save,
      version: 8,
      market: { ...(isRecord(save.market) ? save.market : { saturation: 0 }), index: CONFIG.INDEX_MEAN },
      futures: null,
    };
  }
  return save;
}

/** Migrate then structurally validate — reject anything that would corrupt state. */
export function validateSave(raw: unknown): SaveData {
  if (!isRecord(raw)) throw new Error('Save is not an object');
  const m = migrate(raw);
  const numFields = [
    'tier', 'power', 'runPower', 'rp', 'kp', 'committed', 'stagesAuthorized',
    'routePct', 'sellPct', 'lastSaved', 'credits', 'solvers', 'solverProgress',
  ] as const;
  for (const f of numFields) {
    if (typeof m[f] !== 'number' || !isFinite(m[f] as number)) throw new Error(`Save field "${f}" is invalid`);
  }
  if ((m.tier as number) < 0 || (m.power as number) < 0) throw new Error('Save contains negative values');
  if (!isRecord(m.owned)) throw new Error('Save field "owned" is invalid');
  if (!Array.isArray(m.purchased)) throw new Error('Save field "purchased" is invalid');
  if (!isRecord(m.stats)) throw new Error('Save field "stats" is invalid');
  if (!isRecord(m.dispatch)) throw new Error('Save field "dispatch" is invalid');
  if (!isRecord(m.market)) throw new Error('Save field "market" is invalid');
  if (!isRecord(m.grid)) throw new Error('Save field "grid" is invalid');
  if (!isRecord(m.launchWindow)) throw new Error('Save field "launchWindow" is invalid');
  if (!isRecord(m.accretion)) throw new Error('Save field "accretion" is invalid');
  if (!isRecord(m.relay)) throw new Error('Save field "relay" is invalid');
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
