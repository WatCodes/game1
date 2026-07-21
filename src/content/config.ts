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
  OFFLINE_CAP_SECONDS: 28800, // 8h base, raised by research — idle games punish absence at their peril
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
  ACHIEVEMENT_BONUS: 0.01, // +1% global output per record earned
  // Per-tier mechanical twists (GAME_DESIGN §8) — each inert outside its tier
  LAUNCH_WINDOW_DURATION_SECONDS: 20, // T3: orbital purchases avoid the surcharge
  LAUNCH_GAP_MIN_SECONDS: 60,
  LAUNCH_GAP_MAX_SECONDS: 120,
  LAUNCH_SURCHARGE: 1.4, // ×cost outside the window
  ACCRETION_OUTPUT_BONUS: 0.6, // T5: +60% output at feed rate 100%
  ACCRETION_UPKEEP_PENALTY: 1.2, // +120% upkeep at feed rate 100%
  ACCRETION_HEAT_SECONDS: 60, // time to a flare at feed rate 100% (scales inversely)
  ACCRETION_FLARE_SECONDS: 30, // flare burst = this many seconds of current output
  RELAY_POWER_PENALTY: 0.35, // T6: -35% power at 100% research allocation
  RELAY_RP_BONUS: 1.5, // +150% RP rate at 100% research allocation
  STARTING_CREDITS: 15, // CR on hand at a fresh start — MUST cover the first generator
  // Dispatch Board — the live grid economy (GAME_DESIGN §3.14).
  // Sell rail: CR earned = soldW × price, price = BASE_PRICE / (1 + saturation).
  BASE_PRICE: 1, // CR per Watt at an unsaturated market (the key M7 pacing knob)
  MARKET_SATURATION_GAIN: 1.5, // equilibrium saturation at 100% sell → price = 1/2.5
  MARKET_TAU_SECONDS: 20, // how fast the price reacts to a change in sell share
  // Grid rail: keep at least DEMAND_FRACTION of output on the grid or brown out.
  DEMAND_FRACTION: 0.25, // grid demand as a share of your own generation
  BROWNOUT_SEVERITY: 0.5, // output multiplier bottoms at 1−this when the grid is starved
  // Progressive disclosure (GAME_DESIGN §3.16). Systems arrive one at a time,
  // keyed on LIFETIME power so an unlock is permanent and survives ascension.
  // Until each lands it is inert, not just hidden — a player can't be punished
  // by a mechanic they haven't met. Prime M7 onboarding knobs.
  UNLOCK_BOARD_POWER: 1_000, // Dispatch Board: sell-vs-build becomes a choice
  UNLOCK_GRID_DEMAND_POWER: 15_000, // grid demand floor + brownout start biting
  UNLOCK_TRANSMISSION_POWER: 60_000, // the V×A cap / loss panel appears
  // Megaproject source cost: completing a stage dismantles this fraction of your
  // total owned units, drawn lowest-output-source first. Escalates per stage, so
  // the final stages cut into your best plants — building the wonder cannibalizes
  // the grid (GAME_DESIGN §3.14). Applied on stage completion, once each.
  STAGE_DECOMMISSION: [0.08, 0.12, 0.18, 0.28, 0.45],
  ASCEND_SEED_UNITS: 2, // ascending grants 2× the new tier's cheapest source cost
  AUTOSAVE_INTERVAL_MS: 8000,
} as const;
