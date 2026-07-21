import type { GameState, Num } from './types';
import { CONFIG } from '../content/config';
import { effectiveRoutePct, effectiveSellPct, isUnlocked } from './unlocks';

/**
 * The Dispatch Board's market layer (GAME_DESIGN §3.14). Pure and self-
 * contained — it never imports the economy layer, so brownout can feed back
 * into generation without a circular dependency. Everything here is driven by
 * the allocation *fractions* (sellPct / routePct), which makes it naturally
 * tier-invariant: the same split behaves the same at 10 kW or 10³⁶ W.
 */

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** CR paid per Watt sold. Falls as the market saturates, recovers as it drains.
 *  Flat at BASE_PRICE until the Board introduces the market. */
export function gridPrice(s: GameState): Num {
  if (!isUnlocked(s, 'board')) return CONFIG.BASE_PRICE;
  return CONFIG.BASE_PRICE / (1 + Math.max(0, s.market.saturation));
}

/**
 * Relax market saturation toward the level implied by the current sell share.
 * Selling a bigger slice pushes saturation up (price down); easing off lets it
 * drain back toward zero. `dt` clamps the step so a long offline gap settles to
 * equilibrium instead of overshooting.
 */
export function tickMarket(s: GameState, dt: number): void {
  if (!isUnlocked(s, 'board')) return; // no market yet — price stays flat
  const target = CONFIG.MARKET_SATURATION_GAIN * effectiveSellPct(s);
  const k = Math.min(1, dt / CONFIG.MARKET_TAU_SECONDS);
  s.market.saturation += (target - s.market.saturation) * k;
  if (s.market.saturation < 1e-9) s.market.saturation = 0;
}

/** Share of generation left on the grid rail after Sell and Project take theirs. */
export function gridFraction(s: GameState): number {
  return clamp01(1 - effectiveSellPct(s) - effectiveRoutePct(s));
}

/** 0 = grid demand fully met, 1 = grid rail completely starved.
 *  Always 0 until the grid-demand system unlocks. */
export function brownoutShortfall(s: GameState): number {
  if (!isUnlocked(s, 'gridDemand')) return 0;
  const d = CONFIG.DEMAND_FRACTION;
  if (d <= 0) return 0;
  return clamp01((d - gridFraction(s)) / d);
}

/** Output multiplier from the grid rail: 1 when demand is met, down to
 *  1−BROWNOUT_SEVERITY when the grid is fully starved. */
export function brownoutMult(s: GameState): number {
  return 1 - brownoutShortfall(s) * CONFIG.BROWNOUT_SEVERITY;
}

/** True once the grid rail dips under the demand floor (drives the UI badge). */
export function isBrownedOut(s: GameState): boolean {
  return brownoutShortfall(s) > 0;
}

/** Absolute grid demand in W/s, for display. `genBase` is brownout-free generation. */
export function demandFloor(genBase: Num): Num {
  return CONFIG.DEMAND_FRACTION * genBase;
}

/** CR/s the Sell rail is currently minting. `pps` is delivered generation. */
export function creditsPerSec(s: GameState, pps: Num): Num {
  return Math.max(0, pps) * effectiveSellPct(s) * gridPrice(s);
}
