import type { GameState, Num, TradeRecord } from './types';
import { CONFIG } from '../content/config';
import { canAfford } from './formulas';
import { gridPrice } from './market';
import { isUnlocked } from './unlocks';
import { powerPerSec } from './economy';

/**
 * The Market (rail panel, formerly the Arbitrage Desk in the Agora). Buy Watts
 * off your own grid into a battery when demand is low, release them when it's
 * high. Design: docs/MARKET.md.
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
 * Standing orders keep all three. An order is the player's own rule, set and
 * cancelled at will; the engine never opens or closes a position on its own
 * initiative, and with no orders set, ticking never touches the battery.
 *
 * The round-trip efficiency loss is what stops instant buy→sell being free
 * money, so holding for a genuinely better price is the only source of edge.
 */

/** Opens with the Dispatch Board — the moment the market starts to move. */
export function arbitrageUnlocked(s: GameState): boolean {
  return isUnlocked(s, 'board');
}

/** Battery size in Watts — a window of current generation, so it scales with the
 *  run instead of needing a per-tier table. Cell upgrades widen the window. */
export function reserveCapacity(s: GameState): Num {
  const seconds = CONFIG.RESERVE_CAPACITY_SECONDS * (1 + CONFIG.DESK_CELL_STEP * s.desk.cellLevel);
  return Math.max(0, powerPerSec(s)) * seconds;
}

/** Round-trip efficiency, improved by chemistry upgrades. */
export function reserveEfficiency(s: GameState): number {
  return CONFIG.RESERVE_EFFICIENCY + CONFIG.DESK_CHEM_STEP * s.desk.chemLevel;
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

function record(s: GameState, entry: TradeRecord): void {
  s.desk.log.push(entry);
  if (s.desk.log.length > CONFIG.DESK_LOG_SIZE) s.desk.log.splice(0, s.desk.log.length - CONFIG.DESK_LOG_SIZE);
}

/**
 * Buy `watts` into the battery at the current price. Credits leave now; the
 * Watts are held at a recorded cost basis so profit can be reported honestly
 * rather than implied.
 */
export function chargeReserve(s: GameState, watts: Num, byOrder = false): boolean {
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
  record(s, { kind: 'store', watts: amount, price, profit: 0, byOrder });
  return true;
}

export interface ReleaseResult {
  watts: Num;
  price: number; // CR/W realised
  proceeds: Num; // CR received, after efficiency loss
  profit: Num; // vs what those Watts cost — may be negative, and that's honest
  surge: number; // seconds of Grid Surge this release lit
}

/**
 * Grid Surge earned by a release: a full battery sold at +100% lights the
 * whole SURGE_PROFIT_SECONDS, and smaller or thinner trades light their share.
 *
 * Profit, not price, is what pays. A surge for merely *selling at a peak* would
 * be farmable — store and release in the same instant at a high price, eat the
 * round-trip loss, collect the surge. Profit can only come from the price
 * genuinely moving between the store and the release, so the surge rewards
 * reading the chart and nothing else. Scaling by share of capacity makes ten
 * small trades worth the same as one big one, so splitting can't farm it either.
 */
export function surgeForRelease(watts: Num, capacity: Num, profit: Num, basis: Num): number {
  if (profit <= 0 || basis <= 0 || capacity <= 0) return 0;
  const share = Math.min(1, watts / capacity);
  return CONFIG.SURGE_PROFIT_SECONDS * share * (profit / basis);
}

/** Sell `watts` (or everything, if omitted) out of the battery at the current price. */
export function releaseReserve(s: GameState, watts?: Num, byOrder = false): ReleaseResult | null {
  const amount = Math.min(watts ?? s.reserve.stored, s.reserve.stored);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const price = gridPrice(s);
  const proceeds = amount * price * reserveEfficiency(s);
  const basis = amount * s.reserve.avgPrice;
  const profit = proceeds - basis;
  const surge = surgeForRelease(amount, reserveCapacity(s), profit, basis);
  s.credits += proceeds;
  s.reserve.stored -= amount;
  if (s.reserve.stored <= 1e-9) {
    s.reserve.stored = 0;
    s.reserve.avgPrice = 0;
  }
  if (surge > 0) s.boosts.surgeLeft = Math.min(CONFIG.SURGE_CAP_SECONDS, s.boosts.surgeLeft + surge);
  s.desk.trades += 1;
  if (profit > 0) s.desk.wins += 1;
  s.desk.lifetimeProfit += profit;
  s.desk.bestTrade = Math.max(s.desk.bestTrade, profit);
  // Free Watts (basis 0, from a malformed save) have no meaningful return.
  if (basis > 0) s.desk.bestReturn = Math.max(s.desk.bestReturn, profit / basis);
  record(s, { kind: 'release', watts: amount, price, profit, byOrder });
  return { watts: amount, price, proceeds, profit, surge };
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

// --- Standing orders --------------------------------------------------------

/**
 * Set or clear a standing order. Returns false (and changes nothing) for an
 * order that would cross its partner: a buy at or above the sell line would
 * store and release on the same price, losing the round trip every time.
 */
export function setOrder(s: GameState, side: 'buy' | 'sell', price: number | null): boolean {
  if (price !== null && (!Number.isFinite(price) || price <= 0)) return false;
  const buy = side === 'buy' ? price : s.desk.buyBelow;
  const sell = side === 'sell' ? price : s.desk.sellAbove;
  if (buy !== null && sell !== null && buy >= sell) return false;
  if (side === 'buy') {
    s.desk.buyBelow = price;
    s.desk.buyArmed = true;
  } else {
    s.desk.sellAbove = price;
    s.desk.sellArmed = true;
  }
  return true;
}

/**
 * Run standing orders against the live price. Online only — `creditOffline`
 * never calls this, and docs/MARKET.md says why: while you're away the market
 * settles to the mean, so an order that "filled overnight" would be fiction.
 *
 * An order fires once as the price enters its zone, then rests until the price
 * leaves it. Without that, a buy order would re-fire every tick and sweep every
 * Credit the Sell rail earns into the battery for as long as the dip lasted.
 */
export function tickOrders(s: GameState): void {
  if (!arbitrageUnlocked(s)) return;
  const d = s.desk;
  const price = gridPrice(s);

  if (d.buyBelow !== null) {
    if (price > d.buyBelow) d.buyArmed = true;
    else if (d.buyArmed) {
      d.buyArmed = false;
      if (chargeReserve(s, maxChargeWatts(s), true)) d.ordersFilled += 1;
    }
  }
  if (d.sellAbove !== null) {
    if (price < d.sellAbove) d.sellArmed = true;
    else if (d.sellArmed) {
      d.sellArmed = false;
      if (releaseReserve(s, undefined, true)) d.ordersFilled += 1;
    }
  }
}

// --- Upgrades ---------------------------------------------------------------

export type DeskUpgrade = 'cells' | 'chemistry';

export function deskUpgradeMaxed(s: GameState, kind: DeskUpgrade): boolean {
  return kind === 'cells'
    ? s.desk.cellLevel >= CONFIG.DESK_CELL_MAX_LEVEL
    : s.desk.chemLevel >= CONFIG.DESK_CHEM_MAX_LEVEL;
}

export function deskUpgradeCost(s: GameState, kind: DeskUpgrade): Num {
  return kind === 'cells'
    ? Math.round(CONFIG.DESK_CELL_BASE_COST * Math.pow(CONFIG.DESK_CELL_COST_GROWTH, s.desk.cellLevel))
    : Math.round(CONFIG.DESK_CHEM_BASE_COST * Math.pow(CONFIG.DESK_CHEM_COST_GROWTH, s.desk.chemLevel));
}

export function buyDeskUpgrade(s: GameState, kind: DeskUpgrade): boolean {
  if (!arbitrageUnlocked(s) || deskUpgradeMaxed(s, kind)) return false;
  const cost = deskUpgradeCost(s, kind);
  if (!canAfford(s.credits, cost)) return false;
  s.credits -= cost;
  if (kind === 'cells') s.desk.cellLevel += 1;
  else s.desk.chemLevel += 1;
  return true;
}
