import type { GameState, Num } from './types';
import { CONFIG } from '../content/config';
import { canAfford } from './formulas';
import { gridPrice } from './market';
import { isUnlocked } from './unlocks';
import { powerPerSec } from './economy';

/**
 * The Arbitrage Desk (Agora). Buy Watts off your own grid into a battery when
 * demand is low, release them when it's high.
 *
 * This replaced a futures *wager*, deliberately. Apple's "simulated gambling"
 * definition covers betting virtual currency on an outcome — betting on a price
 * tick is the same shape as betting on a race, however it's framed, and getting
 * that answer wrong on the rating questionnaire can pull a live app. Holding an
 * asset and choosing when to sell is categorically different:
 *
 *   • there is no stake at risk — you hold Watts, not a bet
 *   • there is no clock and no forced settlement — you can always keep waiting
 *   • the outcome is decided by WHEN YOU ACT, not by a draw
 *
 * That also makes the demand chart do real work: you read it to decide, rather
 * than betting against it.
 *
 * The round-trip efficiency loss is what stops instant buy→sell being free
 * money, so holding for a genuinely better price is the only source of edge.
 */

export function arbitrageUnlocked(s: GameState): boolean {
  return isUnlocked(s, 'board') && s.stats.lifetimePower >= CONFIG.UNLOCK_ARBITRAGE_POWER;
}

/** Battery size in Watts — a window of current generation, so it scales with the
 *  run instead of needing a per-tier table. */
export function reserveCapacity(s: GameState): Num {
  return Math.max(0, powerPerSec(s)) * CONFIG.RESERVE_CAPACITY_SECONDS;
}

export function reserveRoom(s: GameState): Num {
  return Math.max(0, reserveCapacity(s) - s.reserve.stored);
}

/** Most Watts the player could charge right now: limited by both the battery's
 *  free space and what they can afford at the current price. */
export function maxChargeWatts(s: GameState): Num {
  const price = gridPrice(s);
  if (price <= 0) return 0;
  return Math.min(reserveRoom(s), Math.max(0, s.credits) / price);
}

/**
 * Buy `watts` into the battery at the current price. Credits leave now; the
 * Watts are held at a recorded cost basis so profit can be reported honestly
 * rather than implied.
 */
export function chargeReserve(s: GameState, watts: Num): boolean {
  if (!arbitrageUnlocked(s)) return false;
  const amount = Math.min(watts, maxChargeWatts(s));
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const price = gridPrice(s);
  const cost = amount * price;
  if (!canAfford(s.credits, cost)) return false;

  const prior = s.reserve.stored;
  s.credits -= cost;
  // Weighted-average cost basis, so partial releases stay fair in both directions.
  s.reserve.avgPrice = prior > 0 ? (prior * s.reserve.avgPrice + amount * price) / (prior + amount) : price;
  s.reserve.stored = prior + amount;
  return true;
}

export interface ReleaseResult {
  watts: Num;
  price: number; // CR/W realised
  proceeds: Num; // CR received, after efficiency loss
  profit: Num; // vs what those Watts cost — may be negative, and that's honest
}

/** Sell `watts` (or everything, if omitted) out of the battery at the current price. */
export function releaseReserve(s: GameState, watts?: Num): ReleaseResult | null {
  const amount = Math.min(watts ?? s.reserve.stored, s.reserve.stored);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const price = gridPrice(s);
  const proceeds = amount * price * CONFIG.RESERVE_EFFICIENCY;
  const basis = amount * s.reserve.avgPrice;
  s.credits += proceeds;
  s.reserve.stored -= amount;
  if (s.reserve.stored <= 1e-9) {
    s.reserve.stored = 0;
    s.reserve.avgPrice = 0;
  }
  return { watts: amount, price, proceeds, profit: proceeds - basis };
}

/**
 * Capacity shrinks if generation drops (a decommission, a brownout, an
 * ascension). Rather than delete Watts the player paid for, spill the excess
 * back as Credits at cost — they're never worse off for something they didn't do.
 */
export function settleOvercapacity(s: GameState): void {
  const cap = reserveCapacity(s);
  if (s.reserve.stored <= cap) return;
  const excess = s.reserve.stored - cap;
  s.credits += excess * s.reserve.avgPrice;
  s.reserve.stored = cap;
  if (s.reserve.stored <= 1e-9) {
    s.reserve.stored = 0;
    s.reserve.avgPrice = 0;
  }
}
