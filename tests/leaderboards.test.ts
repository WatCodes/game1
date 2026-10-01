import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { leaderboardScores } from '../src/engine/leaderboards';
import { chargeReserve, releaseReserve } from '../src/engine/arbitrage';
import { hydrate, serialize, validateSave } from '../src/store/save';
import { CONFIG } from '../src/content/config';

const KP = CONFIG.LEADERBOARD_KP_ID;
const TRADE = CONFIG.LEADERBOARD_BEST_TRADE_ID;

describe('leaderboard scores', () => {
  it('posts nothing for a fresh save', () => {
    const scores = leaderboardScores(createInitialState(0));
    expect(scores[KP]).toBe(0);
    expect(scores[TRADE]).toBe(0);
  });

  it('posts whole Kardashev Points', () => {
    const s = createInitialState(0);
    s.kp = 41.9;
    expect(leaderboardScores(s)[KP]).toBe(41);
  });

  it('never posts a non-finite or unsafe integer', () => {
    const s = createInitialState(0);
    s.kp = Number.POSITIVE_INFINITY;
    expect(leaderboardScores(s)[KP]).toBe(0);
    s.kp = 1e300;
    expect(Number.isSafeInteger(leaderboardScores(s)[KP])).toBe(true);
  });

  it('posts the best trade as tenths of a percent, from real trades', () => {
    const s = createInitialState(0);
    s.stats.lifetimePower = CONFIG.UNLOCK_BOARD_POWER;
    s.sources['battery-bank'].owned = 40;
    s.credits = 1e6;
    s.market.index = 0.8;
    chargeReserve(s, 1000);
    s.market.index = 1.2;
    const r = releaseReserve(s)!;
    const expected = Math.round((r.profit / (1000 * (r.proceeds - r.profit) / 1000)) * 1000);
    expect(leaderboardScores(s)[TRADE]).toBe(expected);
    // A worse trade later does not lower it.
    chargeReserve(s, 1000);
    s.market.index = 0.8;
    releaseReserve(s);
    expect(leaderboardScores(s)[TRADE]).toBe(expected);
  });

  it('caps an impossible best trade from a hand-edited save', () => {
    const save = JSON.parse(JSON.stringify(serialize(createInitialState(0))));
    save.desk.bestReturn = 1e9;
    const s = hydrate(validateSave(save));
    expect(leaderboardScores(s)[TRADE]).toBe(CONFIG.LEADERBOARD_MAX_RETURN * 1000);
  });
});
