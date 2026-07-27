import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { canPlaceFuture, futuresUnlocked, maxStake, placeFuture, tickFutures } from '../src/engine/futures';
import { gridPrice, marketIndex, tickMarketIndex } from '../src/engine/market';
import { tick } from '../src/engine/loop';
import { hydrate, serialize, validateSave } from '../src/store/save';
import { CONFIG } from '../src/content/config';
import type { GameState } from '../src/engine/types';

/** A state with the Board + desk unlocked and money on hand. */
function desk(credits = 10_000): GameState {
  const s = createInitialState(0);
  s.stats.lifetimePower = Math.max(CONFIG.UNLOCK_BOARD_POWER, CONFIG.UNLOCK_FUTURES_POWER);
  s.credits = credits;
  return s;
}

describe('market index', () => {
  it('is neutral and inert before the Board unlocks', () => {
    const s = createInitialState(0);
    s.market.index = 1.5; // even if something set it
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
    for (let i = 0; i < 2000; i++) tickMarketIndex(s, 1, () => 1); // always max positive shock
    expect(s.market.index).toBeLessThanOrEqual(CONFIG.INDEX_MAX);
    for (let i = 0; i < 2000; i++) tickMarketIndex(s, 1, () => 0); // always max negative
    expect(s.market.index).toBeGreaterThanOrEqual(CONFIG.INDEX_MIN);
  });

  it('reverts toward the mean when unshocked', () => {
    const s = desk();
    s.market.index = CONFIG.INDEX_MAX;
    for (let i = 0; i < 200; i++) tickMarketIndex(s, 1, () => 0.5); // shock = 0
    expect(s.market.index).toBeCloseTo(CONFIG.INDEX_MEAN, 2);
  });

  it('caps chart history', () => {
    const s = desk();
    for (let i = 0; i < 5000; i++) tickMarketIndex(s, 1, () => 0.5);
    expect(s.market.indexHistory.length).toBe(CONFIG.INDEX_HISTORY);
  });

  it('does not let one long offline slab dominate the walk', () => {
    const s = desk();
    // A whole night in a single step must not produce a giant directional kick.
    tickMarketIndex(s, 8 * 3600, () => 1);
    expect(s.market.index).toBeLessThanOrEqual(CONFIG.INDEX_MAX);
    expect(s.market.index).toBeGreaterThanOrEqual(CONFIG.INDEX_MIN);
  });
});

describe('futures desk', () => {
  it('stays shut until lifetime power reaches the threshold', () => {
    const s = createInitialState(0);
    s.credits = 1e6;
    expect(futuresUnlocked(s)).toBe(false);
    expect(canPlaceFuture(s, 100)).toBe(false);
  });

  it('rejects stakes below the floor, above the ceiling, or unaffordable', () => {
    const s = desk(1000);
    expect(canPlaceFuture(s, CONFIG.FUTURES_MIN_STAKE - 1)).toBe(false);
    expect(canPlaceFuture(s, maxStake(s) + 1)).toBe(false); // ceiling is a share of balance
    expect(canPlaceFuture(s, maxStake(s))).toBe(true);
  });

  it('never lets a single tap be an all-in', () => {
    const s = desk(1000);
    expect(maxStake(s)).toBeLessThan(s.credits);
    expect(canPlaceFuture(s, s.credits)).toBe(false);
  });

  it('deducts the stake immediately and allows only one open position', () => {
    const s = desk(1000);
    expect(placeFuture(s, 100, true)).toBe(true);
    expect(s.credits).toBe(900);
    expect(s.futures).not.toBeNull();
    expect(placeFuture(s, 100, false)).toBe(false); // already holding one
    expect(s.credits).toBe(900);
  });

  it('pays out a correct call and settles exactly once', () => {
    const s = desk(1000);
    placeFuture(s, 100, true);
    s.market.index = s.futures!.entryIndex + 0.2; // it rose
    expect(tickFutures(s, CONFIG.FUTURES_WINDOW_SECONDS - 1)).toBeNull(); // not yet
    const settled = tickFutures(s, 2)!;
    expect(settled.won).toBe(true);
    expect(settled.payout).toBeCloseTo(100 * CONFIG.FUTURES_PAYOUT, 6);
    expect(s.credits).toBeCloseTo(900 + 100 * CONFIG.FUTURES_PAYOUT, 6);
    expect(s.futures).toBeNull();
    expect(tickFutures(s, 1)).toBeNull(); // and never again
  });

  it('pays nothing on a wrong call', () => {
    const s = desk(1000);
    placeFuture(s, 100, true);
    s.market.index = s.futures!.entryIndex - 0.2; // it fell
    const settled = tickFutures(s, CONFIG.FUTURES_WINDOW_SECONDS)!;
    expect(settled.won).toBe(false);
    expect(s.credits).toBe(900);
  });

  it('treats a flat index as a loss rather than a free refund', () => {
    const s = desk(1000);
    placeFuture(s, 100, true);
    // index untouched — "will it rise" was wrong
    const settled = tickFutures(s, CONFIG.FUTURES_WINDOW_SECONDS)!;
    expect(settled.won).toBe(false);
    expect(s.credits).toBe(900);
  });

  it('is a net sink for a coin-flip bettor', () => {
    // The desk must never be a better business than the grid: 50/50 calls at a
    // sub-2× payout have to bleed value.
    const s = desk(100_000);
    const start = s.credits;
    let up = true;
    for (let i = 0; i < 400; i++) {
      if (!placeFuture(s, 100, up)) break;
      // Alternate the outcome so exactly half the calls are right.
      s.market.index = s.futures!.entryIndex + (up === (i % 2 === 0) ? 0.05 : -0.05);
      tickFutures(s, CONFIG.FUTURES_WINDOW_SECONDS);
      up = !up;
    }
    expect(s.credits).toBeLessThan(start);
  });

  it('runs end to end through the real loop, from a hydrated save', () => {
    // Covers what a live browser session would have shown: a save loads, the
    // index drifts on its own under normal ticking, and an open position settles
    // itself. (The preview pane can't demonstrate this — a hidden page has
    // requestAnimationFrame paused, so the game loop never advances there.)
    const seed = desk(10_000);
    const s = hydrate(validateSave(JSON.parse(JSON.stringify(serialize(seed)))));
    expect(s.market.index).toBe(CONFIG.INDEX_MEAN);

    // 20 Hz, exactly like useGameTick.
    const step = 1 / 20;
    for (let i = 0; i < 20 * 20; i++) tick(s, step);
    expect(s.market.indexHistory.length).toBeGreaterThan(0); // chart has data
    expect(s.market.index).not.toBe(CONFIG.INDEX_MEAN); // it actually moves

    const before = s.credits;
    expect(placeFuture(s, 200, true)).toBe(true);
    expect(s.credits).toBe(before - 200);

    let settled = null as ReturnType<typeof tick>;
    for (let i = 0; i < 20 * (CONFIG.FUTURES_WINDOW_SECONDS + 2) && !settled; i++) {
      settled = tick(s, step);
    }
    expect(settled).not.toBeNull();
    expect(s.futures).toBeNull();
    // This state owns no generators, so nothing else can move Credits — the
    // books must land on exactly one of the two possible outcomes.
    const expected = settled!.won ? before - 200 + 200 * CONFIG.FUTURES_PAYOUT : before - 200;
    expect(s.credits).toBeCloseTo(expected, 6);
    expect(settled!.payout).toBe(settled!.won ? 200 * CONFIG.FUTURES_PAYOUT : 0);
  });

  it('cannot be gamed with the Sell slider, unlike a bet on the raw price', () => {
    const s = desk(1000);
    placeFuture(s, 100, true);
    const entry = s.futures!.entryIndex;
    // Slam Sell to zero: saturation drains, so the *price* rises sharply...
    s.sellPct = 1;
    s.market.saturation = 1.5;
    const pricedHigh = gridPrice(s);
    s.sellPct = 0;
    s.market.saturation = 0;
    expect(gridPrice(s)).toBeGreaterThan(pricedHigh);
    // ...but the index — what the bet is actually on — hasn't moved at all.
    expect(marketIndex(s)).toBe(entry);
    expect(tickFutures(s, CONFIG.FUTURES_WINDOW_SECONDS)!.won).toBe(false);
  });
});
