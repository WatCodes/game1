import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import {
  boostPowerMult,
  buyDispatchRecharge,
  buyPowerBoost,
  buyRpBoost,
  buySolver,
  canClaimDaily,
  claimDaily,
  dailyReward,
  dayKey,
  solverCost,
  tickBoosts,
} from '../src/engine/shop';
import { researchRate } from '../src/engine/research';
import { CONFIG } from '../src/content/config';

const DAY = 86_400_000;
// A fixed local noon so day boundaries are unambiguous in any timezone
const NOON = new Date(2026, 5, 1, 12, 0, 0).getTime();

describe('daily streak', () => {
  it('first claim starts the streak', () => {
    const s = createInitialState(0);
    s.credits = 0; // zero the ledger: this asserts what the claim PAYS
    expect(canClaimDaily(s, NOON)).toBe(true);
    expect(claimDaily(s, NOON)).toBe(CONFIG.DAILY_REWARDS[0]);
    expect(s.daily.streak).toBe(1);
    expect(s.credits).toBe(CONFIG.DAILY_REWARDS[0]);
  });

  it('cannot double-claim the same day', () => {
    const s = createInitialState(0);
    claimDaily(s, NOON);
    expect(canClaimDaily(s, NOON + 3_600_000)).toBe(false);
    expect(claimDaily(s, NOON + 3_600_000)).toBe(0);
    expect(s.daily.streak).toBe(1);
  });

  it('consecutive days grow the streak; one missed day is forgiven', () => {
    const s = createInitialState(0);
    claimDaily(s, NOON);
    expect(claimDaily(s, NOON + DAY)).toBe(CONFIG.DAILY_REWARDS[1]);
    expect(s.daily.streak).toBe(2);
    // skip one day — grace holds the streak
    expect(claimDaily(s, NOON + 3 * DAY)).toBe(CONFIG.DAILY_REWARDS[2]);
    expect(s.daily.streak).toBe(3);
    // skip two days — reset
    expect(claimDaily(s, NOON + 6 * DAY)).toBe(CONFIG.DAILY_REWARDS[0]);
    expect(s.daily.streak).toBe(1);
  });

  it('the cycle repeats with a +10% weekly bonus', () => {
    expect(dailyReward(7)).toBe(CONFIG.DAILY_REWARDS[6]);
    expect(dailyReward(8)).toBe(Math.round(CONFIG.DAILY_REWARDS[0] * 1.1));
    expect(dailyReward(15)).toBe(Math.round(CONFIG.DAILY_REWARDS[0] * 1.2));
  });

  it('dayKey rolls at local midnight', () => {
    const lateNight = new Date(2026, 5, 1, 23, 59).getTime();
    const nextMorning = new Date(2026, 5, 2, 0, 1).getTime();
    expect(dayKey(lateNight)).not.toBe(dayKey(nextMorning));
  });
});

describe('auto-solver purchases', () => {
  it('cost scales per unit owned', () => {
    expect(solverCost(0)).toBe(CONFIG.SOLVER_BASE_COST);
    expect(solverCost(2)).toBe(Math.round(CONFIG.SOLVER_BASE_COST * CONFIG.SOLVER_COST_GROWTH ** 2));
  });

  it('buying deducts credits; refuses when broke', () => {
    const s = createInitialState(0);
    s.credits = CONFIG.SOLVER_BASE_COST;
    expect(buySolver(s)).toBe(true);
    expect(s.solvers).toBe(1);
    expect(s.credits).toBe(0);
    expect(buySolver(s)).toBe(false);
  });
});

describe('boosts', () => {
  it('power boost and surge multiply together', () => {
    const s = createInitialState(0);
    expect(boostPowerMult(s)).toBe(1);
    s.boosts.surgeLeft = 10;
    expect(boostPowerMult(s)).toBe(CONFIG.SURGE_MULT);
    s.credits = CONFIG.BOOST_POWER_COST;
    expect(buyPowerBoost(s)).toBe(true);
    expect(boostPowerMult(s)).toBe(CONFIG.SURGE_MULT * CONFIG.BOOST_MULT);
  });

  it('rp boost doubles the research rate', () => {
    const s = createInitialState(0);
    const before = researchRate(s);
    s.credits = CONFIG.BOOST_RP_COST;
    buyRpBoost(s);
    expect(researchRate(s)).toBeCloseTo(before * CONFIG.BOOST_MULT);
  });

  it('timers count down and expire', () => {
    const s = createInitialState(0);
    s.boosts.surgeLeft = 5;
    s.boosts.powerLeft = 3;
    tickBoosts(s, 4);
    expect(s.boosts.surgeLeft).toBe(1);
    expect(s.boosts.powerLeft).toBe(0);
    expect(boostPowerMult(s)).toBe(CONFIG.SURGE_MULT); // surge still lit
  });

  it('dispatch recharge fills the charge and refuses when already full', () => {
    const s = createInitialState(0);
    s.credits = CONFIG.DISPATCH_RECHARGE_COST * 2;
    s.dispatch.charge = 0.3;
    expect(buyDispatchRecharge(s)).toBe(true);
    expect(s.dispatch.charge).toBe(1);
    expect(buyDispatchRecharge(s)).toBe(false); // already full
    expect(s.credits).toBe(CONFIG.DISPATCH_RECHARGE_COST);
  });
});
