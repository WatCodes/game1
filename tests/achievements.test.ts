import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { achievementMult, checkAchievements } from '../src/engine/achievements';
import { powerPerSec } from '../src/engine/economy';
import { CONFIG } from '../src/content/config';

describe('achievements', () => {
  it('earn once and never twice', () => {
    const s = createInitialState(0);
    s.sources['battery-bank'].owned = 1;
    expect(checkAchievements(s)).toContain('first-spark');
    expect(checkAchievements(s)).toEqual([]); // already earned
    expect(s.achievements).toContain('first-spark');
  });

  it('each record adds the configured global bonus', () => {
    const s = createInitialState(0);
    expect(achievementMult(s)).toBe(1);
    s.sources['battery-bank'].owned = 25;
    checkAchievements(s); // first-spark + first-rack
    expect(achievementMult(s)).toBeCloseTo(1 + 2 * CONFIG.ACHIEVEMENT_BONUS);
    const base = powerPerSec({ ...s, achievements: [] });
    expect(powerPerSec(s)).toBeCloseTo(base * achievementMult(s));
  });

  it('progression records trigger on tier and stats', () => {
    const s = createInitialState(0);
    s.tier = 4;
    s.stats.ascensions = 1;
    s.stats.puzzlesSolved = 10;
    s.daily.streak = 7;
    s.solvers = 6;
    const earned = checkAchievements(s);
    for (const id of ['first-light', 'type-one', 'star-cager', 'switchyard-cadet', 'always-on', 'self-playing']) {
      expect(earned).toContain(id);
    }
  });
});
