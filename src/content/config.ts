// All balancing constants live here (GAME_DESIGN §5). Tuning the game = editing this file.
export const CONFIG = {
  COST_GROWTH: 1.13, // per-source cost multiplier
  SOURCE_MILESTONES: [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000],
  SOURCE_MILESTONE_STEP_AFTER: 500, // past the table, a milestone every +500 owned
  SOURCE_MILESTONE_MULT: 2,
  GLOBAL_MILESTONE_STEP: 1000, // every ×1000 of run-power
  GLOBAL_MILESTONE_MULT: 1.6,
  ERA_MULT_BASE: 4, // baseline ×4 global per tier
  KP_RATE: 0.02, // +2% global per Kardashev Point
  KP_GAIN_K: 3, // scales ascension payout
  KP_RP_BONUS: 0.05, // flat RP/s added per KP
  BASE_RESEARCH_RATE: 0.5, // RP/sec at start
  OFFLINE_CAP_SECONDS: 14400, // 4h base, raised by research
  OFFLINE_MIN_SECONDS: 30, // gaps shorter than this aren't worth a summary
  // Dispatch: charge builds over time; firing early is weak, firing at full
  // charge (or inside a peak-demand window) is the payoff.
  DISPATCH_SECONDS: 30, // burst = pps × this × charge × demand
  DISPATCH_CHARGE_SECONDS: 90, // time to reach full charge
  DISPATCH_MIN_CHARGE: 0.25, // can't fire below this
  PEAK_MULT: 3, // burst multiplier inside a peak-demand window
  PEAK_DURATION_SECONDS: 25,
  PEAK_GAP_MIN_SECONDS: 180, // window cadence (rolled randomly in this range)
  PEAK_GAP_MAX_SECONDS: 360,
  UPKEEP_FACTOR: 0.05, // baseUpkeep = baseOutput × this; unit k drags baseUpkeep×(k−1)
  // Circuit puzzles: pay Credits + a Grid Surge; never required for progression.
  PUZZLE_BASE_REWARD: 10, // Credits per solve at tier 0
  PUZZLE_TIER_REWARD: 6, // + this × tier
  PUZZLE_BONUS_MULT: 1.5, // efficiency bonus for solving near par
  PUZZLE_BONUS_SLACK: 2, // moves over par still counted as efficient
  SURGE_MULT: 1.5, // power multiplier while the surge is lit
  SURGE_MANUAL_SECONDS: 60, // surge added per manual solve
  SURGE_AUTO_SECONDS: 15, // surge added per auto-solve
  SURGE_CAP_SECONDS: 300,
  // Auto-solvers: one solve per SOLVER_SECONDS each; ~6 keep the surge lit 24/7
  SOLVER_SECONDS: 90,
  SOLVER_REWARD_FACTOR: 0.5, // auto-solves pay this × the manual base
  SOLVER_BASE_COST: 100, // Credits; scales SOLVER_COST_GROWTH^owned
  SOLVER_COST_GROWTH: 1.35,
  // Shop boosts (Credits)
  BOOST_MULT: 2,
  BOOST_SECONDS: 900, // 15 min
  BOOST_POWER_COST: 250,
  BOOST_RP_COST: 200,
  DISPATCH_RECHARGE_COST: 75,
  // Daily streak calendar: 7-day cycle, +10% per completed week, miss = reset
  DAILY_REWARDS: [50, 75, 100, 150, 200, 300, 500],
  DAILY_STREAK_BONUS: 0.1,
  STARTING_POWER: 15, // enough for the first battery within seconds
  ASCEND_SEED_UNITS: 2, // ascending grants 2× the new tier's cheapest source cost
  AUTOSAVE_INTERVAL_MS: 8000,
} as const;
