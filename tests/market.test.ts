import { describe, expect, it } from 'vitest';
import {
  brownoutMult,
  brownoutShortfall,
  creditsPerSec,
  demandFloor,
  gridFraction,
  gridPrice,
  isBrownedOut,
  tickMarket,
} from '../src/engine/market';
import { createInitialState } from '../src/engine/state';
import { effectiveRoutePct, effectiveSellPct, isUnlocked } from '../src/engine/unlocks';
import { CONFIG } from '../src/content/config';

/** A run that has already met every system (progressive unlocks are on
 *  lifetime power). Locked-state behaviour is covered separately below. */
function state() {
  const s = createInitialState(0);
  s.stats.lifetimePower = 1e9;
  return s;
}

describe('gridPrice', () => {
  it('is BASE_PRICE at an unsaturated market and falls as it saturates', () => {
    const s = state();
    s.market.saturation = 0;
    expect(gridPrice(s)).toBe(CONFIG.BASE_PRICE);
    s.market.saturation = 1.5;
    expect(gridPrice(s)).toBeCloseTo(CONFIG.BASE_PRICE / 2.5);
    // more saturation → strictly cheaper
    s.market.saturation = 4;
    expect(gridPrice(s)).toBeLessThan(CONFIG.BASE_PRICE / 2.5);
  });
});

describe('tickMarket', () => {
  it('relaxes toward GAIN×sellPct while selling, and back to 0 when idle', () => {
    const s = state();
    s.sellPct = 1;
    // A long step jumps essentially to equilibrium.
    tickMarket(s, CONFIG.MARKET_TAU_SECONDS * 20);
    expect(s.market.saturation).toBeCloseTo(CONFIG.MARKET_SATURATION_GAIN, 3);
    // Stop selling → drains back toward zero.
    s.sellPct = 0;
    tickMarket(s, CONFIG.MARKET_TAU_SECONDS * 20);
    expect(s.market.saturation).toBe(0);
  });

  it('a small step moves only partway (memory / inertia)', () => {
    const s = state();
    s.sellPct = 1;
    tickMarket(s, CONFIG.MARKET_TAU_SECONDS / 4);
    expect(s.market.saturation).toBeGreaterThan(0);
    expect(s.market.saturation).toBeLessThan(CONFIG.MARKET_SATURATION_GAIN);
  });
});

describe('grid rail / brownout', () => {
  it('gridFraction is the remainder after sell + project', () => {
    const s = state();
    s.sellPct = 0.6;
    s.routePct = 0.1;
    expect(gridFraction(s)).toBeCloseTo(0.3);
    // over-allocated rails clamp the grid share at 0
    s.sellPct = 0.8;
    s.routePct = 0.5;
    expect(gridFraction(s)).toBe(0);
  });

  it('no brownout while the grid share meets demand', () => {
    const s = state();
    s.sellPct = 1 - CONFIG.DEMAND_FRACTION; // grid share == demand exactly
    s.routePct = 0;
    expect(brownoutShortfall(s)).toBeCloseTo(0);
    expect(brownoutMult(s)).toBeCloseTo(1);
    expect(isBrownedOut(s)).toBe(false);
  });

  it('a starved grid bottoms output at 1−severity', () => {
    const s = state();
    s.sellPct = 1; // grid share 0 → fully starved
    s.routePct = 0;
    expect(brownoutShortfall(s)).toBe(1);
    expect(brownoutMult(s)).toBeCloseTo(1 - CONFIG.BROWNOUT_SEVERITY);
    expect(isBrownedOut(s)).toBe(true);
  });

  it('demand research lightens the floor, so the same split browns out less', () => {
    const s = state();
    s.sellPct = 1 - CONFIG.DEMAND_FRACTION / 2; // grid at half the demand floor
    s.routePct = 0;
    const plain = brownoutShortfall(s);
    expect(plain).toBeCloseTo(0.5);
    expect(brownoutShortfall(s, 0.8)).toBeLessThan(plain); // −20% demand
    expect(brownoutMult(s, 0.8)).toBeGreaterThan(brownoutMult(s));
  });

  it('partial shortfall scales linearly', () => {
    const s = state();
    // grid share = half the demand floor → shortfall 0.5
    s.sellPct = 1 - CONFIG.DEMAND_FRACTION / 2;
    s.routePct = 0;
    expect(brownoutShortfall(s)).toBeCloseTo(0.5);
    expect(brownoutMult(s)).toBeCloseTo(1 - 0.5 * CONFIG.BROWNOUT_SEVERITY);
  });
});

describe('progressive unlocks', () => {
  it('a fresh run has met none of the systems', () => {
    const s = createInitialState(0);
    expect(isUnlocked(s, 'board')).toBe(false);
    expect(isUnlocked(s, 'gridDemand')).toBe(false);
    expect(isUnlocked(s, 'transmission')).toBe(false);
  });

  it('before the Board, everything sells and nothing routes — a new player always has income', () => {
    const s = createInitialState(0);
    s.sellPct = 0.2; // stored prefs are ignored until the Board exists
    s.routePct = 0.5;
    expect(effectiveSellPct(s)).toBe(1);
    expect(effectiveRoutePct(s)).toBe(0);
  });

  it('before the Board the price is flat and the market cannot saturate', () => {
    const s = createInitialState(0);
    s.sellPct = 1;
    tickMarket(s, CONFIG.MARKET_TAU_SECONDS * 20);
    expect(s.market.saturation).toBe(0);
    expect(gridPrice(s)).toBe(CONFIG.BASE_PRICE);
  });

  it('a locked grid-demand system can never brown out, however the rails are set', () => {
    const s = createInitialState(0);
    s.stats.lifetimePower = CONFIG.UNLOCK_BOARD_POWER; // Board on, demand still off
    s.sellPct = 1;
    s.routePct = 0;
    expect(isUnlocked(s, 'gridDemand')).toBe(false);
    expect(brownoutShortfall(s)).toBe(0);
    expect(brownoutMult(s)).toBe(1);
  });

  it('unlocks are permanent — they key on lifetime power, not the current run', () => {
    const s = createInitialState(0);
    s.stats.lifetimePower = CONFIG.UNLOCK_TRANSMISSION_POWER;
    s.runPower = 0; // just ascended
    expect(isUnlocked(s, 'board')).toBe(true);
    expect(isUnlocked(s, 'transmission')).toBe(true);
  });
});

describe('display helpers', () => {
  it('demandFloor is a share of brownout-free generation', () => {
    expect(demandFloor(1000)).toBeCloseTo(CONFIG.DEMAND_FRACTION * 1000);
  });

  it('creditsPerSec = soldW × price', () => {
    const s = state();
    s.sellPct = 0.5;
    s.market.saturation = 0;
    expect(creditsPerSec(s, 1000)).toBeCloseTo(1000 * 0.5 * CONFIG.BASE_PRICE);
  });
});
