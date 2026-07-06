import type { GameState } from './types';
import { powerPerSec, runAutomation, tickDispatch } from './economy';
import { routeIncome } from './megaproject';
import { researchModifiers, researchRate } from './research';

/**
 * Advance the simulation by dt seconds. Pure state mutation — no React, no
 * clocks (rand is injectable for deterministic tests). Milestones and other
 * derived values are computed on read, not stored.
 */
export function tick(s: GameState, dt: number, rand: () => number = Math.random): void {
  const mods = researchModifiers(s);
  const gain = powerPerSec(s, mods) * dt;
  const routed = routeIncome(s, gain, mods);
  s.power += gain - routed;
  s.runPower += gain;
  s.stats.lifetimePower += gain;
  s.rp += researchRate(s) * dt;
  runAutomation(s, mods);
  tickDispatch(s, dt, rand);
}
