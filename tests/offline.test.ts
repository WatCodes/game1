import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { creditOffline, offlineCap } from '../src/engine/offline';
import { buyResearch } from '../src/engine/research';
import { powerPerSec } from '../src/engine/economy';
import { CONFIG } from '../src/content/config';

const HOUR_MS = 3_600_000;

function producing(lastSaved: number) {
  const s = createInitialState(lastSaved);
  s.sources['battery-bank'].owned = 1; // 0.5 W/s
  s.power = 0;
  return s;
}

describe('creditOffline', () => {
  it('credits pps × elapsed', () => {
    const s = producing(0);
    const pps = powerPerSec(s);
    const summary = creditOffline(s, HOUR_MS);
    expect(summary).not.toBeNull();
    expect(summary!.seconds).toBe(3600);
    expect(s.power).toBeCloseTo(pps * 3600);
    expect(s.runPower).toBeCloseTo(pps * 3600);
  });

  it('clamps to the offline cap', () => {
    const s = producing(0);
    const pps = powerPerSec(s);
    creditOffline(s, 100 * HOUR_MS);
    expect(s.power).toBeCloseTo(pps * CONFIG.OFFLINE_CAP_SECONDS);
  });

  it('research raises the cap', () => {
    const s = producing(0);
    s.rp = 1e9;
    buyResearch(s, 'offline-t0'); // +4h
    expect(offlineCap(s)).toBe(CONFIG.OFFLINE_CAP_SECONDS + 14400);
    const pps = powerPerSec(s);
    creditOffline(s, 100 * HOUR_MS);
    expect(s.power).toBeCloseTo(pps * (CONFIG.OFFLINE_CAP_SECONDS + 14400));
  });

  it('never double-credits', () => {
    const s = producing(0);
    creditOffline(s, HOUR_MS);
    const after = s.power;
    expect(creditOffline(s, HOUR_MS + 1000)).toBeNull(); // 1s later — below threshold
    expect(s.power).toBe(after);
  });

  it('ignores trivial gaps', () => {
    const s = producing(0);
    expect(creditOffline(s, 10_000)).toBeNull();
    expect(s.power).toBe(0);
  });

  it('auto-solvers grind circuits offline, capped like power', () => {
    const s = producing(0);
    s.solvers = 2;
    const summary = creditOffline(s, 100 * HOUR_MS)!; // way past the 4h cap
    const expectedSolves = Math.floor((2 * CONFIG.OFFLINE_CAP_SECONDS) / CONFIG.SOLVER_SECONDS);
    expect(summary.puzzlesSolved).toBe(expectedSolves);
    expect(summary.creditsGained).toBe(expectedSolves * Math.round(CONFIG.PUZZLE_BASE_REWARD * CONFIG.SOLVER_REWARD_FACTOR));
    expect(s.credits).toBe(summary.creditsGained);
  });

  it('boosts expire before the window is credited (no 15-min boost × 4h exploit)', () => {
    const s = producing(0);
    s.boosts.powerLeft = CONFIG.BOOST_SECONDS;
    const basePps = 0.5; // 1 battery, no boost
    creditOffline(s, HOUR_MS);
    expect(s.power).toBeCloseTo(basePps * 3600);
    expect(s.boosts.powerLeft).toBe(0);
  });

  it('reports solver income even with zero power production', () => {
    const s = createInitialState(0); // owns nothing
    s.solvers = 1;
    const summary = creditOffline(s, HOUR_MS);
    expect(summary).not.toBeNull();
    expect(summary!.powerGained).toBe(0);
    expect(summary!.creditsGained).toBeGreaterThan(0);
  });

  it('routes the configured share to the megaproject', () => {
    const s = producing(0);
    s.routePct = 0.5;
    const pps = powerPerSec(s);
    const summary = creditOffline(s, HOUR_MS)!;
    expect(summary.projectGained).toBeCloseTo(pps * 3600 * 0.5);
    expect(s.megaproject.committed).toBeCloseTo(pps * 3600 * 0.5);
    expect(s.power).toBeCloseTo(pps * 3600 * 0.5);
  });
});
