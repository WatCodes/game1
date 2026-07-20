import type { GameState, Num } from './types';
import { GRID, gridCapBase, gridCostBase } from '../content/grid';
import { prestigeMult } from './formulas';

export type GridLane = 'v' | 'a' | 'r';

/**
 * Watts the grid can carry: base × transformer levels × conductor levels.
 * Prestige scales the base — KP is grid-building knowledge, so meta-progress
 * doesn't strand high-KP runs; only WITHIN-run growth (milestones, buildout)
 * outpaces the cap. That pressure is the game.
 */
export function transmissionCap(s: GameState): Num {
  return (
    gridCapBase(s.tier) *
    prestigeMult(s.kp) *
    Math.pow(GRID.V_CAP_STEP, s.grid.vLevel) *
    Math.pow(GRID.A_CAP_STEP, s.grid.aLevel)
  );
}

/** Fraction of delivered power lost to I²R heat. Voltage helps twice. */
export function lossFraction(s: GameState): number {
  return Math.max(
    GRID.LOSS_FLOOR,
    GRID.LOSS_BASE / Math.pow(GRID.LOSS_V_STEP, s.grid.vLevel) / Math.pow(GRID.LOSS_R_STEP, s.grid.rLevel),
  );
}

/** Cosmetic electrical readouts — the cap math is direct, these sell it. */
export function displayVolts(s: GameState): Num {
  return GRID.V_DISPLAY_BASE * Math.pow(GRID.V_DISPLAY_TIER_STEP, s.tier) * Math.pow(GRID.V_DISPLAY_LEVEL_STEP, s.grid.vLevel);
}

export function displayAmps(s: GameState): Num {
  return transmissionCap(s) / displayVolts(s);
}

export function gridUpgradeCost(s: GameState, lane: GridLane): Num {
  const level = lane === 'v' ? s.grid.vLevel : lane === 'a' ? s.grid.aLevel : s.grid.rLevel;
  const growth = lane === 'v' ? GRID.V_COST_GROWTH : lane === 'a' ? GRID.A_COST_GROWTH : GRID.R_COST_GROWTH;
  return gridCostBase(s.tier, lane) * Math.pow(growth, level);
}

export function buyGridUpgrade(s: GameState, lane: GridLane): boolean {
  const cost = gridUpgradeCost(s, lane);
  if (s.credits < cost) return false;
  s.credits -= cost;
  if (lane === 'v') s.grid.vLevel += 1;
  else if (lane === 'a') s.grid.aLevel += 1;
  else s.grid.rLevel += 1;
  return true;
}

/**
 * The Egg-Inc question: which number is red? 'transmission' when the grid
 * cap strands generation, otherwise 'generation'.
 */
export function bindingConstraint(s: GameState, generation: Num): 'generation' | 'transmission' {
  return generation > transmissionCap(s) ? 'transmission' : 'generation';
}

/** Delivered power: carried by the grid, minus line losses. */
export function deliverPower(s: GameState, generation: Num): Num {
  return Math.min(generation, transmissionCap(s)) * (1 - lossFraction(s));
}
