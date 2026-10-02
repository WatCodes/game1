import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { leaderboardScores } from '../src/engine/leaderboards';
import { CONFIG } from '../src/content/config';

const KP = CONFIG.LEADERBOARD_KP_ID;
const ASC = CONFIG.LEADERBOARD_ASCENSION_ID;

describe('leaderboard scores', () => {
  it('posts nothing for a fresh save', () => {
    const scores = leaderboardScores(createInitialState(0));
    expect(scores[KP]).toBe(0);
    expect(scores[ASC]).toBe(0);
  });

  it('posts whole Kardashev Points', () => {
    const s = createInitialState(0);
    s.kp = 41.9;
    expect(leaderboardScores(s)[KP]).toBe(41);
  });

  it('posts the ascension level as the age reached', () => {
    const s = createInitialState(0);
    s.tier = 3;
    expect(leaderboardScores(s)[ASC]).toBe(3);
  });

  it('never posts a non-finite or unsafe integer', () => {
    const s = createInitialState(0);
    s.kp = Number.POSITIVE_INFINITY;
    expect(leaderboardScores(s)[KP]).toBe(0);
    s.kp = 1e300;
    expect(Number.isSafeInteger(leaderboardScores(s)[KP])).toBe(true);
  });

  it('only posts to the two boards that exist', () => {
    expect(Object.keys(leaderboardScores(createInitialState(0))).sort()).toEqual([ASC, KP].sort());
  });
});
