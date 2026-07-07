import { create } from 'zustand';
import type { GameState, Id, MegaprojectStage, Num } from '../engine/types';
import { CONFIG } from '../content/config';
import { getTier } from '../content/tiers';
import { createInitialState } from '../engine/state';
import {
  buy,
  fireDispatch,
  generationPerSec,
  isSourceUnlocked,
  maxAffordable,
  maxSafeCommit,
  nextCost,
  nextUnitNet,
  powerPerSec,
  sourceNet,
  sourceUpkeep,
} from '../engine/economy';
import {
  bindingConstraint,
  buyGridUpgrade,
  displayAmps,
  displayVolts,
  gridUpgradeCost,
  lossFraction,
  transmissionCap,
  type GridLane,
} from '../engine/grid';
import { gridLaneNames } from '../content/grid';
import { accretionOutputMult, accretionUpkeepMult, launchCostMult, relayPowerMult, relayRpMult, setFeedRate, setRelayAllocation } from '../engine/tierTwists';
import {
  nextGlobalMilestone,
  globalMilestoneCount,
  nextSourceMilestone,
  prestigeMult,
  sourceMilestoneMult,
} from '../engine/formulas';
import {
  buyResearch,
  isResearchAvailable,
  researchModifiers,
  researchRate,
} from '../engine/research';
import {
  authorizeStage,
  authorizedBoundary,
  canAuthorizeStage,
  commitPower,
  effectiveCost,
  isMegaprojectComplete,
  megaprojectProgress,
  nextStageResearchBlock,
  stageRpCost,
  stagesCompleted,
} from '../engine/megaproject';
import { ascend, canAscend, projectedKp } from '../engine/ascension';
import { creditOffline, type OfflineSummary } from '../engine/offline';
import { newPuzzle, poweredSet, puzzleReward, rotateTile } from '../engine/puzzle';
import { tick } from '../engine/loop';
import {
  buyDispatchRecharge,
  buyPowerBoost,
  buyRpBoost,
  buySolver,
  canClaimDaily,
  claimDaily,
  dailyReward,
  dayKey,
  solverCost,
} from '../engine/shop';
import { puzzleSkin } from '../content/puzzles';
import { ACHIEVEMENTS } from '../content/achievements';
import { achievementMult } from '../engine/achievements';
import {
  clearStorage,
  exportSave,
  importSave,
  loadBackup,
  loadFromStorage,
  saveToStorage,
} from './save';
import { formatPower } from '../engine/format';

// ---------------------------------------------------------------------------
// Authoritative state: a module-level mutable object the loop ticks at 20 Hz.
// React never subscribes to it — only to the throttled `display` snapshot.
// ---------------------------------------------------------------------------

export const game: GameState = loadFromStorage() ?? createInitialState();
const initialOffline: OfflineSummary | null = creditOffline(game, Date.now());

// --- Display snapshot types ---

export interface SourceView {
  id: Id;
  name: string;
  owned: number;
  unlocked: boolean;
  cost1: Num;
  cost10: Num;
  maxCount: number;
  maxCost: Num;
  output: Num; // net W/s of this line before global mults
  upkeep: Num; // W/s lost to fuel/maintenance
  nextUnitNet: Num; // net gain of buying one more; ≤0 = curtails
  milestoneMult: number;
  toNextMilestone: number;
  nextMilestoneAt: number;
  automated: boolean;
  autoPaused: boolean;
}

export interface ResearchView {
  id: Id;
  name: string;
  desc: string;
  tier: number;
  cost: Num;
  prereqs: Id[]; // raw ids, drives graph edges
  purchased: boolean;
  available: boolean;
  affordable: boolean;
  missingPrereqs: string[];
}

export interface StageView extends MegaprojectStage {
  complete: boolean;
}

export interface DisplaySnapshot {
  power: Num;
  pps: Num;
  rp: Num;
  rpRate: number;
  kp: number;
  prestige: number;
  tier: number;
  era: string;
  scaleCopy: string;
  kardashevLabel?: string;
  runPower: Num;
  globalMilestones: number;
  nextGlobalAt: Num;
  sources: SourceView[];
  research: ResearchView[];
  mega: {
    name: string;
    committed: Num;
    total: Num;
    boundary: Num; // authorized power ceiling
    progress: number;
    stages: StageView[];
    stagesAuthorized: number;
    nextStageRp: Num;
    canAuthorize: boolean;
    authBlockedBy: string | null; // research name blocking the next stage
    complete: boolean;
    routePct: number;
    maxCommit: Num; // safe lump-sum limit (anti-softlock)
  };
  ascend: { can: boolean; projected: number; nextEra: string; nextScale: string };
  dispatch: { charge: number; canFire: boolean; peakActive: boolean; peakLeft: number };
  credits: number;
  boosts: { surgeLeft: number; powerLeft: number; rpLeft: number };
  puzzle: {
    name: string;
    flavor: string;
    size: number;
    tiles: { kind: string; rot: number; role: string; powered: boolean }[];
    moves: number;
    par: number;
    solved: boolean;
    reward: number; // payout if solved on the current move count
    bonusEligible: boolean;
    solvers: number;
    solverProgress: number;
    solveEverySeconds: number;
  };
  shop: {
    canClaimDaily: boolean;
    streak: number;
    nextReward: number; // today's claim (or tomorrow's if already claimed)
    solverCost: number;
    solvers: number;
  };
  achievements: { id: Id; name: string; desc: string; earned: boolean }[];
  achievementMult: number;
  lifetimePower: Num;
  grid: {
    generation: Num;
    cap: Num;
    lossFrac: number;
    volts: Num;
    amps: Num;
    binding: 'generation' | 'transmission';
    lanes: { lane: 'v' | 'a' | 'r'; name: string; level: number; cost: Num; affordable: boolean }[];
  };
  tierTwist:
    | { kind: 'none' }
    | { kind: 'launchWindow'; active: boolean; timeLeft: number; nextIn: number; surchargePct: number }
    | { kind: 'accretion'; feedRate: number; heat: number; outputBonusPct: number; upkeepPenaltyPct: number }
    | { kind: 'relay'; allocation: number; powerPenaltyPct: number; rpBonusPct: number };
}

export interface Toast {
  id: number;
  kind: 'milestone' | 'research' | 'stage' | 'ascend' | 'info' | 'error';
  text: string;
}

function buildDisplay(s: GameState): DisplaySnapshot {
  const mods = researchModifiers(s);
  const tier = getTier(s.tier);
  const next = getTier(s.tier + 1);
  const done = stagesCompleted(s, mods);
  const authBlock = nextStageResearchBlock(s);
  const launchMult = launchCostMult(s);
  return {
    power: s.power,
    pps: powerPerSec(s, mods),
    rp: s.rp,
    rpRate: researchRate(s),
    kp: s.kp,
    prestige: prestigeMult(s.kp),
    tier: s.tier,
    era: tier.era,
    scaleCopy: tier.scaleCopy,
    kardashevLabel: tier.kardashevLabel,
    runPower: s.runPower,
    globalMilestones: globalMilestoneCount(s.runPower),
    nextGlobalAt: nextGlobalMilestone(s.runPower),
    sources: Object.values(s.sources).map((src) => ({
      id: src.id,
      name: src.name,
      owned: src.owned,
      unlocked: isSourceUnlocked(s, src, mods),
      cost1: nextCost(src, 1, launchMult),
      cost10: nextCost(src, 10, launchMult),
      maxCount: maxAffordable(src, s.power, launchMult),
      maxCost: nextCost(src, Math.max(1, maxAffordable(src, s.power, launchMult)), launchMult),
      output: sourceNet(src, mods),
      upkeep: sourceUpkeep(src, mods),
      nextUnitNet: nextUnitNet(src, mods),
      milestoneMult: sourceMilestoneMult(src.owned),
      toNextMilestone: nextSourceMilestone(src.owned) - src.owned,
      nextMilestoneAt: nextSourceMilestone(src.owned),
      automated: !!src.automated,
      autoPaused: !!src.autoPaused,
    })),
    research: Object.values(s.research)
      .filter((n) => n.tier <= s.tier)
      .map((n) => ({
        id: n.id,
        name: n.name,
        desc: n.desc,
        tier: n.tier,
        cost: n.cost,
        prereqs: n.prereqs,
        purchased: !!n.purchased,
        available: isResearchAvailable(s, n),
        affordable: s.rp >= n.cost,
        missingPrereqs: n.prereqs.filter((p) => !s.research[p]?.purchased).map((p) => s.research[p]?.name ?? p),
      })),
    mega: {
      name: s.megaproject.name,
      committed: s.megaproject.committed,
      total: effectiveCost(s, mods),
      boundary: authorizedBoundary(s, mods),
      progress: megaprojectProgress(s, mods),
      stages: s.megaproject.stages.map((st, i) => ({ ...st, complete: i < done })),
      stagesAuthorized: s.megaproject.stagesAuthorized,
      nextStageRp: stageRpCost(s),
      canAuthorize: canAuthorizeStage(s),
      authBlockedBy: authBlock ? (s.research[authBlock]?.name ?? authBlock) : null,
      complete: isMegaprojectComplete(s, mods),
      routePct: s.routePct,
      maxCommit: maxSafeCommit(s, mods),
    },
    ascend: {
      can: canAscend(s),
      projected: projectedKp(s),
      nextEra: next.era,
      nextScale: next.scaleCopy,
    },
    dispatch: {
      charge: s.dispatch.charge,
      canFire: s.dispatch.charge >= CONFIG.DISPATCH_MIN_CHARGE,
      peakActive: s.dispatch.peakLeft > 0,
      peakLeft: s.dispatch.peakLeft,
    },
    credits: s.credits,
    boosts: { ...s.boosts },
    puzzle: buildPuzzleView(s),
    shop: buildShopView(s),
    achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, desc: a.desc, earned: s.achievements.includes(a.id) })),
    achievementMult: achievementMult(s),
    lifetimePower: s.stats.lifetimePower,
    grid: buildGridView(s, mods),
    tierTwist: buildTierTwistView(s),
  };
}

function buildTierTwistView(s: GameState): DisplaySnapshot['tierTwist'] {
  if (s.tier === 3) {
    return {
      kind: 'launchWindow',
      active: s.launchWindow.active,
      timeLeft: s.launchWindow.timeLeft,
      nextIn: s.launchWindow.nextIn,
      surchargePct: Math.round((CONFIG.LAUNCH_SURCHARGE - 1) * 100),
    };
  }
  if (s.tier === 5) {
    return {
      kind: 'accretion',
      feedRate: s.accretion.feedRate,
      heat: s.accretion.heat,
      outputBonusPct: Math.round((accretionOutputMult(s) - 1) * 100),
      upkeepPenaltyPct: Math.round((accretionUpkeepMult(s) - 1) * 100),
    };
  }
  if (s.tier === 6) {
    return {
      kind: 'relay',
      allocation: s.relay.researchAllocation,
      powerPenaltyPct: Math.round((1 - relayPowerMult(s)) * 100),
      rpBonusPct: Math.round((relayRpMult(s) - 1) * 100),
    };
  }
  return { kind: 'none' };
}

function buildGridView(s: GameState, mods: ReturnType<typeof researchModifiers>): DisplaySnapshot['grid'] {
  const generation = generationPerSec(s, mods);
  const names = gridLaneNames(s.tier);
  const levels = [s.grid.vLevel, s.grid.aLevel, s.grid.rLevel];
  return {
    generation,
    cap: transmissionCap(s),
    lossFrac: lossFraction(s),
    volts: displayVolts(s),
    amps: displayAmps(s),
    binding: bindingConstraint(s, generation),
    lanes: (['v', 'a', 'r'] as const).map((lane, i) => {
      const cost = gridUpgradeCost(s, lane);
      return { lane, name: names[i], level: levels[i], cost, affordable: s.power >= cost };
    }),
  };
}

function buildShopView(s: GameState): DisplaySnapshot['shop'] {
  const now = Date.now();
  const claimable = canClaimDaily(s, now);
  // The streak the NEXT claim will pay out at: continues if the last claim was
  // within the grace window (yesterday or the day before), or today already.
  const continues =
    !claimable ||
    s.daily.lastClaimDay === dayKey(now - 86_400_000) ||
    s.daily.lastClaimDay === dayKey(now - 2 * 86_400_000);
  return {
    canClaimDaily: claimable,
    streak: s.daily.streak,
    nextReward: dailyReward(continues ? s.daily.streak + 1 : 1),
    solverCost: solverCost(s.solvers),
    solvers: s.solvers,
  };
}

function buildPuzzleView(s: GameState): DisplaySnapshot['puzzle'] {
  const skin = puzzleSkin(s.tier);
  const powered = poweredSet(s.puzzle);
  return {
    name: skin.name,
    flavor: skin.flavor,
    size: s.puzzle.size,
    tiles: s.puzzle.tiles.map((t, i) => ({ kind: t.kind, rot: t.rot, role: t.role, powered: powered.has(i) })),
    moves: s.puzzle.moves,
    par: s.puzzle.par,
    solved: s.puzzle.solved,
    reward: puzzleReward(s.puzzle.tier, s.puzzle.moves, s.puzzle.par),
    bonusEligible: s.puzzle.moves <= s.puzzle.par + CONFIG.PUZZLE_BONUS_SLACK,
    solvers: s.solvers,
    solverProgress: s.solverProgress,
    solveEverySeconds: s.solvers > 0 ? CONFIG.SOLVER_SECONDS / s.solvers : 0,
  };
}

// --- Store ---

export type DevCheat =
  | 'power'
  | 'rp'
  | 'credits'
  | 'kp'
  | 'mega'
  | 'dispatch'
  | 'peak'
  | 'solve'
  | 'solver'
  | 'warp'
  | 'window'
  | 'flare'
  | 'nextTier';

export interface Cinematic {
  era: string;
  scaleCopy: string;
  kardashevLabel?: string;
  kpGained: number;
}

interface GameStore {
  display: DisplaySnapshot;
  toasts: Toast[];
  offline: OfflineSummary | null;
  cinematic: Cinematic | null;
  actions: {
    buySource: (id: Id, count: number | 'max') => void;
    toggleAutomation: (id: Id) => void;
    buyGridLane: (lane: GridLane) => void;
    buyResearchNode: (id: Id) => void;
    commitStoredPower: (fraction: number) => void;
    authorizeNextStage: () => void;
    setRoutePct: (pct: number) => void;
    setAccretionFeedRate: (rate: number) => void;
    setRelayAllocation: (pct: number) => void;
    doDispatch: () => void;
    doAscend: () => void;
    rotatePuzzleTile: (idx: number) => void;
    dealNewPuzzle: () => void;
    claimDailyReward: () => void;
    buyShopSolver: () => void;
    buyShopBoost: (kind: 'power' | 'rp' | 'dispatch') => void;
    dismissOffline: () => void;
    dismissCinematic: () => void;
    dismissToast: (id: number) => void;
    exportSaveString: () => string;
    importSaveString: (encoded: string) => boolean;
    restoreFromBackup: () => boolean;
    hardReset: () => void;
    devCheat: (kind: DevCheat) => void;
  };
}

let toastSeq = 0;

const pushToast = (kind: Toast['kind'], text: string) =>
  useGame.setState((st) => ({ toasts: [...st.toasts.slice(-4), { id: ++toastSeq, kind, text }] }));

/** Ambient toasts fire on state transitions, whether from a buy or a tick. */
function detectTransitions(prev: DisplaySnapshot, next: DisplaySnapshot): void {
  if (next.globalMilestones > prev.globalMilestones && prev.runPower > 0) {
    pushToast('milestone', `Grid milestone — global output ×${CONFIG.GLOBAL_MILESTONE_MULT}`);
  }
  for (const src of next.sources) {
    const old = prev.sources.find((p) => p.id === src.id);
    if (old && src.milestoneMult > old.milestoneMult) {
      pushToast('milestone', `${src.name} ×2 — ${src.owned} owned`);
    }
  }
  const prevStages = prev.mega.stages.filter((st) => st.complete).length;
  const nextStages = next.mega.stages.filter((st) => st.complete).length;
  if (nextStages > prevStages && prev.mega.name === next.mega.name) {
    pushToast('stage', `Stage complete: ${next.mega.stages[nextStages - 1].label}`);
  }
  if (next.mega.complete && !prev.mega.complete && prev.mega.name === next.mega.name) {
    pushToast('ascend', `${next.mega.name} complete — Ascension available`);
  }
  if (next.dispatch.peakActive && !prev.dispatch.peakActive) {
    pushToast('info', `⚡ PEAK DEMAND — dispatch pays ×${CONFIG.PEAK_MULT} for ${CONFIG.PEAK_DURATION_SECONDS}s`);
  }
  for (const a of next.achievements) {
    if (a.earned && !prev.achievements.find((p) => p.id === a.id)?.earned) {
      pushToast('ascend', `🏆 Record: ${a.name} — output +${Math.round(CONFIG.ACHIEVEMENT_BONUS * 100)}%`);
    }
  }
}

/** Snapshot the authoritative state into React. The loop calls this at ~12 Hz. */
export function publishDisplay(): void {
  const prev = useGame.getState().display;
  const next = buildDisplay(game);
  detectTransitions(prev, next);
  useGame.setState({ display: next });
}

export const useGame = create<GameStore>((set) => {
  const refresh = publishDisplay;

  return {
    display: buildDisplay(game),
    toasts: [],
    offline: initialOffline,
    cinematic: null,
    actions: {
      buySource: (id, count) => {
        if (buy(game, id, count) > 0) refresh();
      },
      toggleAutomation: (id) => {
        const src = game.sources[id];
        if (!src?.automated) return;
        src.autoPaused = !src.autoPaused;
        saveToStorage(game);
        refresh();
      },
      buyGridLane: (lane) => {
        if (buyGridUpgrade(game, lane)) {
          saveToStorage(game);
          refresh();
        }
      },
      buyResearchNode: (id) => {
        const node = game.research[id];
        if (buyResearch(game, id)) {
          pushToast('research', `Research complete: ${node.name}`);
          saveToStorage(game);
          refresh();
        }
      },
      commitStoredPower: (fraction) => {
        const wanted = game.power * Math.max(0, Math.min(1, fraction));
        // Clamp to the safe limit: never leave a dead grid with no buyable source
        const amount = Math.min(wanted, maxSafeCommit(game));
        if (commitPower(game, amount) > 0) refresh();
      },
      authorizeNextStage: () => {
        const stage = game.megaproject.stages[game.megaproject.stagesAuthorized];
        if (authorizeStage(game)) {
          pushToast('stage', `Stage authorized: ${stage.label}`);
          saveToStorage(game);
          refresh();
        }
      },
      setRoutePct: (pct) => {
        game.routePct = Math.max(0, Math.min(1, pct));
        refresh();
      },
      setAccretionFeedRate: (rate) => {
        setFeedRate(game, rate);
        refresh();
      },
      setRelayAllocation: (pct) => {
        setRelayAllocation(game, pct);
        refresh();
      },
      doDispatch: () => {
        const result = fireDispatch(game);
        if (result) {
          const label = result.peak ? `PEAK ×${CONFIG.PEAK_MULT}! ` : '';
          pushToast('info', `${label}Dispatch: +${formatPower(result.gained)}`);
          refresh();
        }
      },
      doAscend: () => {
        const before = game.tier;
        const gained = ascend(game);
        if (game.tier !== before) {
          const t = getTier(game.tier);
          set({
            cinematic: { era: t.era, scaleCopy: t.scaleCopy, kardashevLabel: t.kardashevLabel, kpGained: gained },
          });
          saveToStorage(game);
          refresh();
        }
      },
      rotatePuzzleTile: (idx) => {
        const result = rotateTile(game, idx);
        if (result) {
          const bonus = result.bonus ? ' (efficiency bonus!)' : '';
          pushToast('milestone', `⚡ Circuit energized — +${result.reward} CR${bonus} · surge extended`);
          saveToStorage(game);
        }
        refresh();
      },
      dealNewPuzzle: () => {
        game.puzzle = newPuzzle(game.tier);
        refresh();
      },
      claimDailyReward: () => {
        const reward = claimDaily(game, Date.now());
        if (reward > 0) {
          pushToast('info', `Daily reward: +${reward} CR — streak ${game.daily.streak}`);
          saveToStorage(game);
          refresh();
        }
      },
      buyShopSolver: () => {
        if (buySolver(game)) {
          pushToast('info', `Auto-Solver online — ${game.solvers} running`);
          saveToStorage(game);
          refresh();
        }
      },
      buyShopBoost: (kind) => {
        const bought =
          kind === 'power' ? buyPowerBoost(game) : kind === 'rp' ? buyRpBoost(game) : buyDispatchRecharge(game);
        if (bought) {
          const label =
            kind === 'power' ? '×2 power for 15 min' : kind === 'rp' ? '×2 research for 15 min' : 'dispatch recharged';
          pushToast('info', `Boost active: ${label}`);
          saveToStorage(game);
          refresh();
        }
      },
      dismissOffline: () => set({ offline: null }),
      dismissCinematic: () => set({ cinematic: null }),
      dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
      exportSaveString: () => exportSave(game),
      importSaveString: (encoded) => {
        try {
          const imported = importSave(encoded);
          Object.assign(game, imported);
          saveToStorage(game);
          refresh();
          pushToast('info', 'Save imported');
          return true;
        } catch (err) {
          pushToast('error', err instanceof Error ? err.message : 'Import failed');
          return false;
        }
      },
      restoreFromBackup: () => {
        const restored = loadBackup();
        if (!restored) {
          pushToast('error', 'No usable backup found');
          return false;
        }
        Object.assign(game, restored);
        saveToStorage(game);
        refresh();
        pushToast('info', 'Backup restored');
        return true;
      },
      hardReset: () => {
        clearStorage();
        Object.assign(game, createInitialState());
        refresh();
        pushToast('info', 'Grid reset to zero');
      },
      // Dev-only tools — gated in the UI, but harmless if reached: single-player
      devCheat: (kind) => {
        switch (kind) {
          case 'power': {
            const gain = Math.max(1e4, powerPerSec(game) * 3600);
            game.power += gain;
            game.runPower += gain;
            game.stats.lifetimePower += gain;
            break;
          }
          case 'rp':
            game.rp += 1000;
            break;
          case 'credits':
            game.credits += 1000;
            break;
          case 'kp':
            game.kp += 25;
            break;
          case 'mega':
            game.megaproject.stagesAuthorized = game.megaproject.stages.length;
            game.megaproject.committed = game.megaproject.totalCost;
            break;
          case 'dispatch':
            game.dispatch.charge = 1;
            break;
          case 'peak':
            game.dispatch.peakLeft = CONFIG.PEAK_DURATION_SECONDS;
            break;
          case 'solve':
            if (!game.puzzle.solved) {
              game.puzzle.solved = true;
              game.credits += puzzleReward(game.puzzle.tier, game.puzzle.par, game.puzzle.par);
              game.boosts.surgeLeft = Math.min(CONFIG.SURGE_CAP_SECONDS, game.boosts.surgeLeft + CONFIG.SURGE_MANUAL_SECONDS);
              game.stats.puzzlesSolved += 1;
            }
            break;
          case 'solver':
            game.solvers += 1;
            break;
          case 'warp':
            for (let i = 0; i < 3600; i++) tick(game, 1);
            break;
          case 'window':
            game.launchWindow.active = true;
            game.launchWindow.timeLeft = CONFIG.LAUNCH_WINDOW_DURATION_SECONDS;
            break;
          case 'flare':
            game.accretion.heat = 1;
            break;
          case 'nextTier':
            // Reuses the real ascension code path (same resets everywhere
            // else get) instead of a bespoke tier-jump — quick way to QA
            // tier-gated content like the T3/T5/T6 twists.
            game.megaproject.stagesAuthorized = game.megaproject.stages.length;
            game.megaproject.committed = game.megaproject.totalCost;
            ascend(game);
            break;
        }
        pushToast('info', `[dev] ${kind}`);
        refresh();
      },
    },
  };
});
