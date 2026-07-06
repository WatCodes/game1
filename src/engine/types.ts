export type Num = number; // swap-point for break_infinity.js later
export type Id = string;

export interface PowerSource {
  id: Id;
  name: string;
  tier: number;
  baseCost: Num;
  costGrowth: number;
  baseOutput: Num; // W/s per unit, gross
  baseUpkeep: Num; // W/s of fuel/maintenance drag; unit k costs baseUpkeep×(k−1)
  owned: number;
  unlockedBy?: Id | { tier: number }; // research id or tier gate
  automated?: boolean; // manager purchased (via research)
}

export type ResearchEffect =
  | { kind: 'unlockSource'; sourceId: Id }
  | { kind: 'multSource'; sourceId: Id; x: number }
  | { kind: 'multGlobal'; x: number }
  | { kind: 'multRpRate'; x: number }
  | { kind: 'reduceMegaprojectCost'; x: number } // 0..1, fraction removed
  | { kind: 'reduceUpkeep'; x: number } // 0..1, fraction removed from all upkeep
  | { kind: 'increaseOfflineCap'; seconds: number }
  | { kind: 'unlockAutomation'; sourceId: Id };

export interface ResearchNode {
  id: Id;
  name: string;
  desc: string;
  tier: number;
  cost: Num; // RP
  prereqs: Id[];
  effect: ResearchEffect;
  purchased?: boolean;
}

export interface MegaprojectStage {
  reward: number; // permanent (this run) multiplier granted on stage completion
  label: string;
}

export interface Megaproject {
  id: Id;
  name: string;
  tier: number;
  totalCost: Num; // Power to complete (before research reductions)
  rpCost: Num; // total RP to authorize stages 2..n (stage 1 is free)
  stages: MegaprojectStage[];
  stageResearch: (Id | null)[]; // research required before a stage can be authorized
  completionReward: number; // global mult while complete (this run)
  committed: Num; // runtime progress
  stagesAuthorized: number; // stages cleared to receive power (starts at 1)
}

export interface KardashevTier {
  index: number;
  era: string;
  scaleCopy: string; // "a single household" — rendered as "Powering: X"
  baseCostMult: number;
  kpDivisor: Num; // baseline lifetime run-power for the KP payout formula
  kardashevLabel?: string; // "Type I" etc.
}

export interface GameState {
  version: number;
  tier: number;
  power: Num;
  runPower: Num; // lifetime power this run — drives global milestones + KP, resets on ascend
  rp: Num;
  kp: number; // Kardashev Points (permanent)
  sources: Record<Id, PowerSource>; // current tier's sources only
  research: Record<Id, ResearchNode>; // all tiers — purchases are permanent
  megaproject: Megaproject; // current tier's project
  routePct: number; // % of income diverted to megaproject (0..1)
  dispatch: {
    charge: number; // 0..1, builds over time; firing spends it
    peakLeft: number; // seconds remaining of an active peak-demand window
    nextPeakIn: number; // seconds until the next window opens
  };
  lastSaved: number; // epoch ms
  stats: { lifetimePower: Num; ascensions: number; startedAt: number };
}
