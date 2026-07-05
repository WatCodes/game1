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
  DISPATCH_COOLDOWN_MS: 30000,
  DISPATCH_SECONDS: 45,
  STARTING_POWER: 15, // enough for the first battery within seconds
  ASCEND_SEED_UNITS: 2, // ascending grants 2× the new tier's cheapest source cost
  AUTOSAVE_INTERVAL_MS: 8000,
} as const;
