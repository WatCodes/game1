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
  autoPaused?: boolean; // player toggled the manager off (manager still owned)
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

export interface PuzzleState {
  tier: number;
  size: number;
  cells: boolean[]; // size×size, row-major; true = over-loaded district
  moves: number;
  par: number; // minimal taps from the dealt board
  solved: boolean; // latched until a new board is dealt
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
  // Delivery infrastructure — rebuilt each run, like sources
  grid: { vLevel: number; aLevel: number; rLevel: number };
  // Per-tier mechanical twists (GAME_DESIGN §8) — inert outside their tier,
  // reset on ascend like grid/puzzle
  launchWindow: { active: boolean; timeLeft: number; nextIn: number }; // T3
  accretion: { feedRate: number; heat: number }; // T5
  relay: { researchAllocation: number }; // T6
  // Puzzle & shop meta-economy — persists through ascension, like KP
  credits: number;
  puzzle: PuzzleState; // current tier's circuit, regenerated on ascend
  solvers: number; // auto-solver units owned
  solverProgress: number; // fractional solves banked by auto-solvers
  boosts: {
    surgeLeft: number; // seconds of ×SURGE_MULT power from puzzle solves
    powerLeft: number; // seconds of shop ×2 power boost
    rpLeft: number; // seconds of shop ×2 RP boost
  };
  daily: { lastClaimDay: string; streak: number }; // local YYYY-MM-DD
  achievements: Id[]; // earned records — permanent, +bonus each
  lastSaved: number; // epoch ms
  stats: { lifetimePower: Num; ascensions: number; startedAt: number; puzzlesSolved: number };
}
