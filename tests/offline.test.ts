import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { creditOffline, offlineCap } from '../src/engine/offline';
import { buyResearch } from '../src/engine/research';
import { powerPerSec } from '../src/engine/economy';
import { saveToStorage } from '../src/store/save';
import { CONFIG } from '../src/content/config';

const HOUR_MS = 3_600_000;

function producing(lastSaved: number) {
  const s = createInitialState(lastSaved);
  s.sources['battery-bank'].owned = 1; // 0.5 W/s
  s.stats.lifetimePower = 1e9; // past every progressive-unlock gate
  s.credits = 0; // zero the ledger so CR assertions measure earnings only
  return s;
}

describe('creditOffline', () => {
  it('generates pps × elapsed and sells the default share for CR', () => {
    const s = producing(0);
    const pps = powerPerSec(s);
    const summary = creditOffline(s, HOUR_MS);
    expect(summary).not.toBeNull();
    expect(summary!.seconds).toBe(3600);
    expect(summary!.powerGained).toBeCloseTo(pps * 3600);
    expect(s.runPower).toBeCloseTo(pps * 3600);
    // default sellPct 0.6 at an unsaturated market → 60% sells at BASE_PRICE
    expect(summary!.creditsGained).toBeCloseTo(pps * 3600 * 0.6 * CONFIG.BASE_PRICE);
  });

  it('clamps generation to the offline cap', () => {
    const s = producing(0);
    const pps = powerPerSec(s);
    creditOffline(s, 100 * HOUR_MS);
    expect(s.runPower).toBeCloseTo(pps * CONFIG.OFFLINE_CAP_SECONDS);
  });

  it('research raises the cap', () => {
    const s = producing(0);
    s.rp = 1e9;
    buyResearch(s, 'offline-t0'); // +4h
    expect(offlineCap(s)).toBe(CONFIG.OFFLINE_CAP_SECONDS + 14400);
    const pps = powerPerSec(s);
    creditOffline(s, 100 * HOUR_MS);
    expect(s.runPower).toBeCloseTo(pps * (CONFIG.OFFLINE_CAP_SECONDS + 14400));
  });

  it('never double-credits', () => {
    const s = producing(0);
    creditOffline(s, HOUR_MS);
    const after = s.runPower;
    expect(creditOffline(s, HOUR_MS + 1000)).toBeNull(); // 1s later — below threshold
    expect(s.runPower).toBe(after);
  });

  it('ignores trivial gaps', () => {
    const s = producing(0);
    expect(creditOffline(s, 10_000)).toBeNull();
    expect(s.runPower).toBe(0);
  });

  it('auto-solvers grind boards offline, capped like generation', () => {
    const s = producing(0);
    s.sellPct = 0; // isolate solver income (no Sell-rail CR)
    s.solvers = 2;
    const summary = creditOffline(s, 100 * HOUR_MS)!; // way past the 4h cap
    const expectedSolves = Math.floor((2 * CONFIG.OFFLINE_CAP_SECONDS) / CONFIG.SOLVER_SECONDS);
    expect(summary.puzzlesSolved).toBe(expectedSolves);
    expect(summary.creditsGained).toBe(expectedSolves * Math.round(CONFIG.PUZZLE_BASE_REWARD * CONFIG.SOLVER_REWARD_FACTOR));
    expect(s.credits).toBe(summary.creditsGained);
  });

  it('boosts expire before the window is credited (no 15-min boost × 4h exploit)', () => {
    const boosted = producing(0);
    boosted.boosts.powerLeft = CONFIG.BOOST_SECONDS;
    creditOffline(boosted, HOUR_MS);
    const control = producing(0); // identical state, no boost
    creditOffline(control, HOUR_MS);
    expect(boosted.runPower).toBeCloseTo(control.runPower);
    expect(boosted.boosts.powerLeft).toBe(0);
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
    s.sellPct = 0; // isolate the Project rail from the Sell rail
    s.routePct = 0.5;
    const pps = powerPerSec(s);
    const summary = creditOffline(s, HOUR_MS)!;
    expect(summary.projectGained).toBeCloseTo(pps * 3600 * 0.5);
    expect(s.megaproject.committed).toBeCloseTo(pps * 3600 * 0.5);
  });
});

/**
 * The phone lifecycle, which is the common one and was silently unhandled: iOS
 * and Android SUSPEND a WebView rather than unloading it. The page survives, so
 * the app's one-shot load-time credit never runs again — only an explicit
 * resume hook can pay out the time away. These lock in the arithmetic that hook
 * depends on.
 */
describe('background → resume', () => {
  // Node has no localStorage, and saveToStorage no-ops without one — but the
  // `lastSaved` stamp it writes is exactly what the resume path measures from.
  function installStorage() {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  }

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  it('credits the whole suspended span, measured from the hide-time save', () => {
    installStorage();
    const s = producing(0);
    const pps = powerPerSec(s);
    saveToStorage(s, 5_000); // visibilitychange:hidden, 5s into the session
    const summary = creditOffline(s, 5_000 + HOUR_MS)!; // ...an hour later, resumed
    expect(summary.seconds).toBe(3600);
    expect(summary.powerGained).toBeCloseTo(pps * 3600);
  });

  it('a second resume with no gap pays nothing (no farming the app switcher)', () => {
    installStorage();
    const s = producing(0);
    saveToStorage(s, 5_000);
    const first = creditOffline(s, 5_000 + HOUR_MS)!;
    const banked = s.credits;
    expect(creditOffline(s, 5_000 + HOUR_MS)).toBeNull();
    expect(s.credits).toBe(banked);
    expect(first.creditsGained).toBeGreaterThan(0);
  });

  it('short app-switches are credited but stay below the modal threshold', () => {
    installStorage();
    const s = producing(0);
    saveToStorage(s, 0);
    // 45s away: past OFFLINE_MIN_SECONDS so it pays, under
    // RESUME_SUMMARY_SECONDS so the store shows a toast, not a full screen.
    const summary = creditOffline(s, 45_000)!;
    expect(summary.seconds).toBe(45);
    expect(summary.creditsGained).toBeGreaterThan(0);
    expect(summary.seconds).toBeLessThan(CONFIG.RESUME_SUMMARY_SECONDS);
  });

  it('a real absence clears the modal threshold, so the ad placement shows', () => {
    installStorage();
    const s = producing(0);
    saveToStorage(s, 0);
    const summary = creditOffline(s, HOUR_MS)!;
    expect(summary.seconds).toBeGreaterThanOrEqual(CONFIG.RESUME_SUMMARY_SECONDS);
    expect(summary.creditsGained).toBeGreaterThan(0);
  });
});
