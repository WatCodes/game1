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

/**
 * CR paid per Watt sold — two independent halves:
 *   • saturation, which the player drives with the Sell slider, and
 *   • the demand index, which drifts on its own.
 * Flat at BASE_PRICE until the Board introduces the market.
 */
export function gridPrice(s: GameState): Num {
  if (!isUnlocked(s, 'board')) return CONFIG.BASE_PRICE;
  return (CONFIG.BASE_PRICE / (1 + Math.max(0, s.market.saturation))) * marketIndex(s);
}

/** The exogenous half. 1 (neutral) until the Board exists, so early pricing is
 *  perfectly predictable while the player is still learning the basics. */
export function marketIndex(s: GameState): number {
  if (!isUnlocked(s, 'board')) return 1;
  return s.market.index;
}

/**
 * Mean-reverting random walk (a discrete Ornstein–Uhlenbeck step): pulled gently
 * toward INDEX_MEAN, kicked each step by volatility scaled with √dt so the walk
 * behaves the same whether stepped at 20 Hz or in one offline slab. Clamped, so
 * demand can never vanish or run away.
 */
export function tickMarketIndex(s: GameState, dt: number, rand: () => number = Math.random): void {
  if (!isUnlocked(s, 'board') || dt <= 0) return;
  // Long gaps (offline) settle to the mean rather than compounding one huge
  // random kick — you should never return from a night away to a rigged market.
  const step = Math.min(dt, CONFIG.MARKET_TAU_SECONDS);
  const pull = (CONFIG.INDEX_MEAN - s.market.index) * CONFIG.INDEX_REVERSION * step;
  // Box–Muller would be tidier, but a mean-zero uniform kick is plenty here and
  // keeps this dependency-free and trivially deterministic in tests.
  const shock = (rand() * 2 - 1) * CONFIG.INDEX_VOLATILITY * Math.sqrt(step);
  const next = s.market.index + pull + shock;
  s.market.index = Math.max(CONFIG.INDEX_MIN, Math.min(CONFIG.INDEX_MAX, next));

  // Sample the chart on a fixed cadence so history is time-uniform regardless of
  // tick rate.
  s.market.sampleIn -= dt;
  if (s.market.sampleIn <= 0) {
    s.market.sampleIn = CONFIG.INDEX_SAMPLE_SECONDS;
    s.market.indexHistory.push(s.market.index);
    if (s.market.indexHistory.length > CONFIG.INDEX_HISTORY) {
      s.market.indexHistory.splice(0, s.market.indexHistory.length - CONFIG.INDEX_HISTORY);
    }
  }
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

/**
 * Research modifiers arrive as plain numbers rather than a ResearchModifiers
 * import: research → tierTwists → market already, so importing research here
 * would close a cycle. Callers all hold `mods` anyway.
 */

/** 0 = grid demand fully met, 1 = grid rail completely starved.
 *  Always 0 until the grid-demand system unlocks. */
export function brownoutShortfall(s: GameState, demandMult = 1): number {
  if (!isUnlocked(s, 'gridDemand')) return 0;
  const d = CONFIG.DEMAND_FRACTION * Math.max(0, demandMult);
  if (d <= 0) return 0;
  return clamp01((d - gridFraction(s)) / d);
}

/** Output multiplier from the grid rail: 1 when demand is met, down to
 *  1−BROWNOUT_SEVERITY when the grid is fully starved. */
export function brownoutMult(s: GameState, demandMult = 1): number {
  return 1 - brownoutShortfall(s, demandMult) * CONFIG.BROWNOUT_SEVERITY;
}

/** True once the grid rail dips under the demand floor (drives the UI badge). */
export function isBrownedOut(s: GameState, demandMult = 1): boolean {
  return brownoutShortfall(s, demandMult) > 0;
}

/** Absolute grid demand in W/s, for display. `genBase` is brownout-free generation. */
export function demandFloor(genBase: Num, demandMult = 1): Num {
  return CONFIG.DEMAND_FRACTION * Math.max(0, demandMult) * genBase;
}

/** CR/s the Sell rail is currently minting. `pps` is delivered generation. */
export function creditsPerSec(s: GameState, pps: Num, creditMult = 1): Num {
  return Math.max(0, pps) * effectiveSellPct(s) * gridPrice(s) * creditMult;
}
