import { create } from 'zustand';
import type { GameState, Id, MegaprojectStage, Num } from '../engine/types';
import { CONFIG } from '../content/config';
import { getTier } from '../content/tiers';
import { createInitialState } from '../engine/state';
import {
  buy,
  dispatch,
  isSourceUnlocked,
  maxAffordable,
  nextCost,
  powerPerSec,
  sourceOutput,
} from '../engine/economy';
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
  commitPower,
  effectiveCost,
  isMegaprojectComplete,
  megaprojectProgress,
  stagesCompleted,
} from '../engine/megaproject';
import { ascend, canAscend, projectedKp } from '../engine/ascension';
import { creditOffline, type OfflineSummary } from '../engine/offline';
import {
  clearStorage,
  exportSave,
  importSave,
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
  output: Num; // this line's W/s before global mults
  milestoneMult: number;
  toNextMilestone: number;
  nextMilestoneAt: number;
  automated: boolean;
}

export interface ResearchView {
  id: Id;
  name: string;
  desc: string;
  tier: number;
  cost: Num;
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
    progress: number;
    stages: StageView[];
    complete: boolean;
    routePct: number;
  };
  ascend: { can: boolean; projected: number; nextEra: string; nextScale: string };
  dispatchReadyIn: number; // seconds; 0 = ready
}

export interface Toast {
  id: number;
  kind: 'milestone' | 'research' | 'stage' | 'ascend' | 'info' | 'error';
  text: string;
}

function buildDisplay(s: GameState, now: number): DisplaySnapshot {
  const mods = researchModifiers(s);
  const tier = getTier(s.tier);
  const next = getTier(s.tier + 1);
  const done = stagesCompleted(s, mods);
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
      cost1: nextCost(src, 1),
      cost10: nextCost(src, 10),
      maxCount: maxAffordable(src, s.power),
      maxCost: nextCost(src, Math.max(1, maxAffordable(src, s.power))),
      output: sourceOutput(src, mods),
      milestoneMult: sourceMilestoneMult(src.owned),
      toNextMilestone: nextSourceMilestone(src.owned) - src.owned,
      nextMilestoneAt: nextSourceMilestone(src.owned),
      automated: !!src.automated,
    })),
    research: Object.values(s.research)
      .filter((n) => n.tier <= s.tier)
      .map((n) => ({
        id: n.id,
        name: n.name,
        desc: n.desc,
        tier: n.tier,
        cost: n.cost,
        purchased: !!n.purchased,
        available: isResearchAvailable(s, n),
        affordable: s.rp >= n.cost,
        missingPrereqs: n.prereqs.filter((p) => !s.research[p]?.purchased).map((p) => s.research[p]?.name ?? p),
      })),
    mega: {
      name: s.megaproject.name,
      committed: s.megaproject.committed,
      total: effectiveCost(s, mods),
      progress: megaprojectProgress(s, mods),
      stages: s.megaproject.stages.map((st, i) => ({ ...st, complete: i < done })),
      complete: isMegaprojectComplete(s, mods),
      routePct: s.routePct,
    },
    ascend: {
      can: canAscend(s),
      projected: projectedKp(s),
      nextEra: next.era,
      nextScale: next.scaleCopy,
    },
    dispatchReadyIn: Math.max(0, (s.dispatchReadyAt - now) / 1000),
  };
}

// --- Store ---

interface GameStore {
  display: DisplaySnapshot;
  toasts: Toast[];
  offline: OfflineSummary | null;
  actions: {
    buySource: (id: Id, count: number | 'max') => void;
    buyResearchNode: (id: Id) => void;
    commitStoredPower: (fraction: number) => void;
    setRoutePct: (pct: number) => void;
    doDispatch: () => void;
    doAscend: () => void;
    dismissOffline: () => void;
    dismissToast: (id: number) => void;
    exportSaveString: () => string;
    importSaveString: (encoded: string) => boolean;
    hardReset: () => void;
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
}

/** Snapshot the authoritative state into React. The loop calls this at ~12 Hz. */
export function publishDisplay(): void {
  const prev = useGame.getState().display;
  const next = buildDisplay(game, Date.now());
  detectTransitions(prev, next);
  useGame.setState({ display: next });
}

export const useGame = create<GameStore>((set) => {
  const refresh = publishDisplay;

  return {
    display: buildDisplay(game, Date.now()),
    toasts: [],
    offline: initialOffline,
    actions: {
      buySource: (id, count) => {
        if (buy(game, id, count) > 0) refresh();
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
        const amount = game.power * Math.max(0, Math.min(1, fraction));
        if (commitPower(game, amount) > 0) refresh();
      },
      setRoutePct: (pct) => {
        game.routePct = Math.max(0, Math.min(1, pct));
        refresh();
      },
      doDispatch: () => {
        const result = dispatch(game, Date.now());
        if (result) {
          const spike = result.demand > 1.25 ? 'Peak demand! ' : '';
          pushToast('info', `${spike}Dispatch: +${formatPower(result.gained)}`);
          refresh();
        }
      },
      doAscend: () => {
        const before = game.tier;
        const gained = ascend(game);
        if (game.tier !== before) {
          pushToast('ascend', `⚡ ENERGIZED — +${gained} Kardashev Points`);
          saveToStorage(game);
          refresh();
        }
      },
      dismissOffline: () => set({ offline: null }),
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
      hardReset: () => {
        clearStorage();
        Object.assign(game, createInitialState());
        refresh();
        pushToast('info', 'Grid reset to zero');
      },
    },
  };
});
