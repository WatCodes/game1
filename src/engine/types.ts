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
  | { kind: 'unlockAutomation'; sourceId: Id }
  // One per Dispatch Board rail (GAME_DESIGN §3.15), so the Lab has real
  // leverage over the live economy rather than only over raw output.
  | { kind: 'multCredits'; x: number } // Sell rail: more CR per Watt sold
  | { kind: 'reduceDemand'; x: number } // Grid rail: 0..1 off the demand floor
  | { kind: 'reduceDecommission'; x: number }; // Project rail: 0..1 off the stage dismantle

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
  decommissionedStages: number; // stages whose source-dismantle cost already fired
}

/**
 * Feeder Balance — a Futoshiki-style constraint board.
 *
 * Every row and column must carry each load level 1..size exactly once, and
 * every marked pair of neighbours must respect its `<` / `>`. Cells the player
 * fills cycle 0 → 1 → … → size → 0.
 */
export interface PuzzleState {
  tier: number;
  size: number;
  cells: number[]; // size×size, row-major; 0 = unset, 1..size = load level
  givens: boolean[]; // same indexing; true = fixed by the board, not tappable
  /**
   * Inequalities between orthogonally adjacent cells. 0 = no clue, 1 = the
   * lower-indexed cell must be LESS than its partner, 2 = greater.
   *
   * `across[r * (size - 1) + c]` relates (r,c) to (r,c+1).
   * `down[r * size + c]` relates (r,c) to (r+1,c).
   */
  across: number[];
  down: number[];
  moves: number;
  par: number; // minimum taps to fill every blank from the dealt board
  solved: boolean; // latched until a new board is dealt
}

/**
 * Stored Watts held back from the market, with the average price paid for them.
 *
 * This replaced a futures *wager* deliberately. A stake on a random outcome is
 * gambling however it's dressed — Apple's "simulated gambling" definition covers
 * betting virtual currency on races, and betting on a price tick is the same
 * shape. Holding an asset and choosing when to sell is not: there is no stake at
 * risk, no forced settlement, and no clock. The player can always wait.
 */
export interface ReserveState {
  stored: Num; // Watts in the battery
  avgPrice: number; // CR/W cost basis, for honest profit/loss reporting
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
  // Dispatch Board: generation is split across three rails (must sum to ≤1).
  // routePct = Project rail; sellPct = Sell-to-market rail; the remainder
  // (1 − sellPct − routePct) is the Grid rail, which must cover the demand
  // floor or the run takes a brownout penalty.
  routePct: number; // % of generation routed to the megaproject (0..1)
  sellPct: number; // % of generation sold to the grid for CR (0..1)
  market: {
    saturation: number; // ≥0; rises as you sell, decays back; depresses price
    /**
     * Exogenous demand — the half of the price the player does NOT control.
     * Mean-reverts toward 1 on a random walk. Without it the market only ever
     * reacted to the Sell slider, which made the "live economy" inert and made
     * betting on the price a free win (slide Sell to 0, price always rises).
     */
    index: number;
    /** Recent index samples, newest last — drives the Agora chart. Capped. */
    indexHistory: number[];
    /** Seconds until the next history sample is taken. */
    sampleIn: number;
  };
  /** The battery: Watts bought off your own grid, awaiting a better price. */
  reserve: ReserveState;
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
