import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import {
  arbitrageUnlocked,
  chargeReserve,
  maxChargeWatts,
  releaseReserve,
  reserveCapacity,
  settleOvercapacity,
} from '../src/engine/arbitrage';
import { gridPrice, marketIndex, tickMarketIndex } from '../src/engine/market';
import { tick } from '../src/engine/loop';
import { hydrate, serialize, validateSave } from '../src/store/save';
import { CONFIG } from '../src/content/config';
import type { GameState } from '../src/engine/types';

/** Unlocked desk with generation (so the battery has capacity) and money. */
function desk(credits = 100_000): GameState {
  const s = createInitialState(0);
  s.stats.lifetimePower = Math.max(CONFIG.UNLOCK_BOARD_POWER, CONFIG.UNLOCK_ARBITRAGE_POWER);
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

describe('arbitrage desk', () => {
  it('stays shut until lifetime power reaches the threshold', () => {
    const s = createInitialState(0);
    s.credits = 1e6;
    expect(arbitrageUnlocked(s)).toBe(false);
    expect(chargeReserve(s, 100)).toBe(false);
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
});
