import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import {
  arbitrageUnlocked,
  buyDeskUpgrade,
  chargeReserve,
  deskUpgradeCost,
  maxChargeWatts,
  releaseReserve,
  reserveCapacity,
  reserveEfficiency,
  setOrder,
  settleOvercapacity,
  surgeForRelease,
  tickOrders,
} from '../src/engine/arbitrage';
import { gridPrice, marketIndex, tickMarketIndex } from '../src/engine/market';
import { tick } from '../src/engine/loop';
import { hydrate, serialize, validateSave } from '../src/store/save';
import { CONFIG } from '../src/content/config';
import type { GameState } from '../src/engine/types';

/** Unlocked desk with generation (so the battery has capacity) and money. */
function desk(credits = 100_000): GameState {
  const s = createInitialState(0);
  s.stats.lifetimePower = CONFIG.UNLOCK_BOARD_POWER;
  s.sources['battery-bank'].owned = 40; // gives the battery a non-zero capacity
  s.credits = credits;
  return s;
}

describe('market index', () => {
  it('is neutral and inert before the Board unlocks', () => {
    const s = createInitialState(0);
    s.market.index = 1.5;
    expect(marketIndex(s)).toBe(1);
    tickMarketIndex(s, 1, () => 1);
    expect(s.market.index).toBe(1.5); // untouched — no market yet
  });

  it('moves the delivered price', () => {
    const s = desk();
    s.market.index = 1;
    const base = gridPrice(s);
    s.market.index = 1.5;
    expect(gridPrice(s)).toBeCloseTo(base * 1.5, 6);
  });

  it('stays inside its band under a persistently extreme walk', () => {
    const s = desk();
    for (let i = 0; i < 2000; i++) tickMarketIndex(s, 1, () => 1);
    expect(s.market.index).toBeLessThanOrEqual(CONFIG.INDEX_MAX);
    for (let i = 0; i < 2000; i++) tickMarketIndex(s, 1, () => 0);
    expect(s.market.index).toBeGreaterThanOrEqual(CONFIG.INDEX_MIN);
  });

  it('reverts toward the mean when unshocked', () => {
    const s = desk();
    s.market.index = CONFIG.INDEX_MAX;
    for (let i = 0; i < 200; i++) tickMarketIndex(s, 1, () => 0.5);
    expect(s.market.index).toBeCloseTo(CONFIG.INDEX_MEAN, 2);
  });

  it('caps chart history', () => {
    const s = desk();
    for (let i = 0; i < 5000; i++) tickMarketIndex(s, 1, () => 0.5);
    expect(s.market.indexHistory.length).toBe(CONFIG.INDEX_HISTORY);
  });

  it('does not let one long offline slab dominate the walk', () => {
    const s = desk();
    tickMarketIndex(s, 8 * 3600, () => 1);
    expect(s.market.index).toBeLessThanOrEqual(CONFIG.INDEX_MAX);
    expect(s.market.index).toBeGreaterThanOrEqual(CONFIG.INDEX_MIN);
  });
});

describe('the market', () => {
  it('opens with the Dispatch Board, not before', () => {
    const s = createInitialState(0);
    s.credits = 1e6;
    s.stats.lifetimePower = CONFIG.UNLOCK_BOARD_POWER - 1;
    expect(arbitrageUnlocked(s)).toBe(false);
    expect(chargeReserve(s, 100)).toBe(false);
    s.stats.lifetimePower = CONFIG.UNLOCK_BOARD_POWER;
    expect(arbitrageUnlocked(s)).toBe(true);
  });

  it('charges at the current price and records a cost basis', () => {
    const s = desk();
    s.market.index = 1;
    const price = gridPrice(s);
    const before = s.credits;
    expect(chargeReserve(s, 100)).toBe(true);
    expect(s.reserve.stored).toBeCloseTo(100, 6);
    expect(s.reserve.avgPrice).toBeCloseTo(price, 6);
    expect(s.credits).toBeCloseTo(before - 100 * price, 6);
  });

  it('averages the cost basis across several charges', () => {
    const s = desk();
    s.market.index = 0.8;
    const cheap = gridPrice(s);
    chargeReserve(s, 100);
    s.market.index = 1.6;
    const dear = gridPrice(s);
    chargeReserve(s, 100);
    expect(s.reserve.avgPrice).toBeCloseTo((cheap + dear) / 2, 6);
  });

  it('cannot store more than the battery holds or the wallet affords', () => {
    const s = desk(10);
    expect(maxChargeWatts(s)).toBeLessThanOrEqual(reserveCapacity(s));
    // Wallet-bound: 10 CR buys only 10/price Watts.
    expect(maxChargeWatts(s)).toBeCloseTo(10 / gridPrice(s), 6);
    chargeReserve(s, 1e12);
    expect(s.credits).toBeGreaterThanOrEqual(0);
    expect(s.reserve.stored).toBeLessThanOrEqual(reserveCapacity(s) + 1e-6);
  });

  it('pays out buying low and selling high', () => {
    const s = desk();
    s.market.index = CONFIG.INDEX_MIN;
    chargeReserve(s, 1000);
    const spent = 1000 * s.reserve.avgPrice;
    s.market.index = CONFIG.INDEX_MAX;
    const r = releaseReserve(s)!;
    expect(r.profit).toBeGreaterThan(0);
    expect(r.proceeds).toBeCloseTo(1000 * gridPrice(s) * CONFIG.RESERVE_EFFICIENCY, 6);
    expect(r.proceeds).toBeGreaterThan(spent);
    expect(s.reserve.stored).toBe(0);
    expect(s.reserve.avgPrice).toBe(0);
  });

  it('reports a real loss when sold below the basis', () => {
    const s = desk();
    s.market.index = CONFIG.INDEX_MAX;
    chargeReserve(s, 1000);
    s.market.index = CONFIG.INDEX_MIN;
    const r = releaseReserve(s)!;
    expect(r.profit).toBeLessThan(0); // honest, not hidden
  });

  it('makes an instant round trip a loss, so only real movement pays', () => {
    // Otherwise "store then immediately release" would be free money.
    const s = desk();
    const before = s.credits;
    chargeReserve(s, 1000);
    releaseReserve(s);
    expect(s.credits).toBeLessThan(before);
  });

  it('has no stake at risk and no clock — ticking never touches the position', () => {
    // This is what separates it from a wager: only the player closes it.
    const s = desk();
    chargeReserve(s, 500);
    const stored = s.reserve.stored;
    const basis = s.reserve.avgPrice;
    for (let i = 0; i < 20 * 300; i++) tick(s, 1 / 20); // five minutes
    expect(s.reserve.stored).toBeCloseTo(stored, 6);
    expect(s.reserve.avgPrice).toBeCloseTo(basis, 6);
  });

  it('refunds at cost rather than deleting Watts when capacity shrinks', () => {
    const s = desk();
    chargeReserve(s, maxChargeWatts(s));
    const stored = s.reserve.stored;
    const basis = s.reserve.avgPrice;
    const credits = s.credits;
    // Generation collapses (a decommission), so the battery shrinks.
    s.sources['battery-bank'].owned = 1;
    settleOvercapacity(s);
    const cap = reserveCapacity(s);
    expect(s.reserve.stored).toBeCloseTo(cap, 6);
    expect(s.credits).toBeCloseTo(credits + (stored - cap) * basis, 6);
  });

  it('survives a save round trip with its cost basis intact', () => {
    const s = desk();
    s.market.index = 0.9;
    chargeReserve(s, 700);
    const restored = hydrate(validateSave(JSON.parse(JSON.stringify(serialize(s)))));
    expect(restored.reserve.stored).toBeCloseTo(s.reserve.stored, 6);
    expect(restored.reserve.avgPrice).toBeCloseTo(s.reserve.avgPrice, 6);
  });

  it('stores and releases a share, keeping the basis on what remains', () => {
    const s = desk();
    s.market.index = 0.8;
    chargeReserve(s, 1000);
    const basis = s.reserve.avgPrice;
    s.market.index = 1.4;
    const r = releaseReserve(s, 250)!;
    expect(r.watts).toBeCloseTo(250, 6);
    expect(s.reserve.stored).toBeCloseTo(750, 6);
    expect(s.reserve.avgPrice).toBeCloseTo(basis, 6);
  });

  it('keeps a ledger: trades, wins, net profit, best trade, a capped log', () => {
    const s = desk();
    for (let i = 0; i < CONFIG.DESK_LOG_SIZE; i++) {
      s.market.index = 0.7;
      chargeReserve(s, 100);
      s.market.index = 1.5;
      releaseReserve(s);
    }
    s.market.index = 1.5;
    chargeReserve(s, 100);
    s.market.index = 0.7;
    const loss = releaseReserve(s)!.profit;
    expect(s.desk.trades).toBe(CONFIG.DESK_LOG_SIZE + 1);
    expect(s.desk.wins).toBe(CONFIG.DESK_LOG_SIZE);
    expect(loss).toBeLessThan(0);
    expect(s.desk.log).toHaveLength(CONFIG.DESK_LOG_SIZE);
    expect(s.desk.log[s.desk.log.length - 1]).toMatchObject({ kind: 'release', byOrder: false });
    expect(s.desk.lifetimeProfit).toBeLessThan(s.desk.bestTrade * CONFIG.DESK_LOG_SIZE); // the loss counts
  });
});

describe('grid surge from the market', () => {
  it('is lit by profit, in proportion to the trade', () => {
    const s = desk();
    s.market.index = CONFIG.INDEX_MIN;
    chargeReserve(s, maxChargeWatts(s));
    s.market.index = CONFIG.INDEX_MAX;
    const r = releaseReserve(s)!;
    expect(r.surge).toBeGreaterThan(0);
    expect(s.boosts.surgeLeft).toBe(Math.min(CONFIG.SURGE_CAP_SECONDS, r.surge));
  });

  it('is never lit by a loss, or by flipping at a peak', () => {
    // The farm this guards against: store and release in the same instant at a
    // high price. Selling high is not enough — the price has to have *moved*.
    const s = desk();
    s.market.index = CONFIG.INDEX_MAX;
    chargeReserve(s, maxChargeWatts(s));
    releaseReserve(s);
    expect(s.boosts.surgeLeft).toBe(0);
  });

  it('cannot be farmed by splitting one trade into many', () => {
    const one = surgeForRelease(1000, 1000, 300, 1000);
    const tenth = surgeForRelease(100, 1000, 30, 100);
    expect(tenth * 10).toBeCloseTo(one, 9);
  });

  it('caps', () => {
    const s = desk();
    s.boosts.surgeLeft = CONFIG.SURGE_CAP_SECONDS - 1;
    s.market.index = CONFIG.INDEX_MIN;
    chargeReserve(s, maxChargeWatts(s));
    s.market.index = CONFIG.INDEX_MAX;
    releaseReserve(s);
    expect(s.boosts.surgeLeft).toBe(CONFIG.SURGE_CAP_SECONDS);
  });
});

describe('standing orders', () => {
  it('a sell order releases once the price reaches it', () => {
    const s = desk();
    s.market.index = 0.8;
    chargeReserve(s, 500);
    expect(setOrder(s, 'sell', gridPrice(s) * 1.2)).toBe(true);
    tickOrders(s);
    expect(s.reserve.stored).toBeGreaterThan(0); // not there yet
    s.market.index = 1.2;
    tickOrders(s);
    expect(s.reserve.stored).toBe(0);
    expect(s.desk.ordersFilled).toBe(1);
    expect(s.desk.log[s.desk.log.length - 1]).toMatchObject({ kind: 'release', byOrder: true });
  });

  it('a buy order fills once per dip, not every tick', () => {
    // Without re-arming, a buy order would sweep every Credit the Sell rail
    // earns into the battery for as long as the dip lasted.
    const s = desk();
    s.market.index = 1;
    setOrder(s, 'buy', gridPrice(s) * 0.9);
    s.market.index = 0.8;
    tickOrders(s);
    const stored = s.reserve.stored;
    expect(stored).toBeGreaterThan(0);
    s.credits += 1e6; // income keeps arriving during the dip
    for (let i = 0; i < 50; i++) tickOrders(s);
    expect(s.reserve.stored).toBe(stored);
    expect(s.desk.ordersFilled).toBe(1);
    // The price leaves the zone and comes back: that is a new dip.
    releaseReserve(s); // make room, so the second fill has somewhere to go
    s.market.index = 1;
    tickOrders(s);
    s.market.index = 0.8;
    tickOrders(s);
    expect(s.desk.ordersFilled).toBe(2);
  });

  it('refuses a pair that would cross', () => {
    const s = desk();
    expect(setOrder(s, 'sell', 1)).toBe(true);
    expect(setOrder(s, 'buy', 1)).toBe(false);
    expect(setOrder(s, 'buy', 1.2)).toBe(false);
    expect(s.desk.buyBelow).toBeNull();
    expect(setOrder(s, 'buy', 0.9)).toBe(true);
    expect(setOrder(s, 'sell', 0.85)).toBe(false);
    expect(setOrder(s, 'sell', null)).toBe(true); // clearing is always allowed
    expect(setOrder(s, 'buy', -1)).toBe(false);
  });

  it('do nothing before the market opens', () => {
    const s = createInitialState(0);
    s.credits = 1e6;
    s.desk.buyBelow = 100;
    tickOrders(s);
    expect(s.reserve.stored).toBe(0);
  });

  it('run in the live loop, and with none set the loop never trades', () => {
    const s = desk();
    s.market.index = 1;
    chargeReserve(s, 300);
    setOrder(s, 'sell', 0.0001); // already above: fills on the next tick
    tick(s, 1 / 20, () => 0.5);
    expect(s.reserve.stored).toBe(0);
  });
});

describe('market upgrades', () => {
  it('cells widen the battery; chemistry narrows the round-trip loss', () => {
    const s = desk(1e9);
    const cap = reserveCapacity(s);
    expect(buyDeskUpgrade(s, 'cells')).toBe(true);
    expect(reserveCapacity(s)).toBeCloseTo(cap * (1 + CONFIG.DESK_CELL_STEP), 6);
    expect(buyDeskUpgrade(s, 'chemistry')).toBe(true);
    expect(reserveEfficiency(s)).toBeCloseTo(CONFIG.RESERVE_EFFICIENCY + CONFIG.DESK_CHEM_STEP, 9);
  });

  it('cost grows per level and stops at the cap', () => {
    const s = desk(1e12);
    const first = deskUpgradeCost(s, 'chemistry');
    buyDeskUpgrade(s, 'chemistry');
    expect(deskUpgradeCost(s, 'chemistry')).toBeGreaterThan(first);
    while (buyDeskUpgrade(s, 'chemistry'));
    expect(s.desk.chemLevel).toBe(CONFIG.DESK_CHEM_MAX_LEVEL);
  });

  it('never makes the battery lossless, so flipping never pays', () => {
    expect(CONFIG.RESERVE_EFFICIENCY + CONFIG.DESK_CHEM_STEP * CONFIG.DESK_CHEM_MAX_LEVEL).toBeLessThan(1);
    const s = desk(1e12);
    while (buyDeskUpgrade(s, 'chemistry'));
    const before = s.credits;
    chargeReserve(s, 1000);
    releaseReserve(s);
    expect(s.credits).toBeLessThan(before);
  });
});
