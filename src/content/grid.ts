// The three-lane delivery system (GAME_DESIGN §3.13): generation must be
// CARRIED (transformers × conductors set a V×A cap) and survives LOSSES
// (I²R drag cut by voltage and superconductors). All balancing lives here.
import { unitOutput } from './tiers';
import { eraMult } from '../engine/formulas';
import { megaCost } from './tiers';

export const GRID = {
  // Transmission cap at level 0 ≈ comfortable early-run generation; the run's
  // multipliers (milestones, KP) outgrow it — that pressure is the game.
  CAP_FACTOR: 400, // capBase = unitOutput(tier) × eraMult(tier) × this
  V_CAP_STEP: 2.0, // each transformer level doubles carried power…
  A_CAP_STEP: 1.8, // …conductor levels are cheaper but weaker
  LOSS_BASE: 0.15, // 15% of delivered power lost at level 0
  LOSS_V_STEP: 1.35, // each transformer level divides losses (V↑ ⇒ I↓ ⇒ I²R↓↓)
  LOSS_R_STEP: 1.6, // each superconductor level divides losses
  LOSS_FLOOR: 0.005,
  // Upgrade costs (Power), as a slice of the tier's megaproject
  V_COST_DIV: 50,
  V_COST_GROWTH: 3.2,
  A_COST_DIV: 120,
  A_COST_GROWTH: 2.2,
  R_COST_DIV: 30,
  R_COST_GROWTH: 4.0,
  // Display flavor: volts/amps ladders (cosmetic — cap math is direct)
  V_DISPLAY_BASE: 120, // volts at tier 0 level 0
  V_DISPLAY_TIER_STEP: 60,
  V_DISPLAY_LEVEL_STEP: 2,
} as const;

export function gridCapBase(tier: number): number {
  return unitOutput(tier) * eraMult(tier) * GRID.CAP_FACTOR;
}

export function gridCostBase(tier: number, lane: 'v' | 'a' | 'r'): number {
  const div = lane === 'v' ? GRID.V_COST_DIV : lane === 'a' ? GRID.A_COST_DIV : GRID.R_COST_DIV;
  return megaCost(tier) / div;
}

// [transformer, conductor, superconductor] display names per tier
const LANE_NAMES: [string, string, string][] = [
  ['Pole Transformers', 'ACSR Lines', 'Copper Bus'],
  ['Substation Banks', 'HVDC Cables', 'Litz Windings'],
  ['GW-Class Transformers', 'Supergrid Trunks', 'Cryo Conductors'],
  ['Beamed-Power Masts', 'Rectenna Fields', 'Waveguide Arrays'],
  ['Stellar Step-Ups', 'Statite Relays', 'Plasma Conduits'],
  ['Ergo Converters', 'Frame-Drag Couplers', 'Exotic Superconductors'],
  ['Relay Nexuses', 'Warp-Lane Trunks', 'Null-Loss Lattices'],
  ['Planck Transformers', 'Vacuum Waveguides', 'Acausal Shunts'],
];

export function gridLaneNames(tier: number): [string, string, string] {
  return LANE_NAMES[tier] ?? ['Exotic Step-Ups', 'Exotic Trunks', 'Exotic Shunts'];
}
