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
  STARTING_POWER: 15, // enough for the first battery within seconds
  ASCEND_SEED_UNITS: 2, // ascending grants 2× the new tier's cheapest source cost
  AUTOSAVE_INTERVAL_MS: 8000,
} as const;
