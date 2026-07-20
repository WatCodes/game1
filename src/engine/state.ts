import type { GameState } from './types';
import { CONFIG } from '../content/config';
import { buildSources } from '../content/sources';
import { buildMegaproject } from '../content/megaprojects';
import { buildResearch } from '../content/research';
import { newPuzzle } from './puzzle';
import { defaultTierTwistState } from './tierTwists';

export const SAVE_VERSION = 6;

export function createInitialState(now: number = Date.now(), rand: () => number = Math.random): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    tier: 0,
    power: CONFIG.STARTING_POWER,
    runPower: 0,
    rp: 0,
    kp: 0,
    sources: {},
    research: {},
    megaproject: buildMegaproject(0),
    routePct: 0,
    sellPct: 0.6, // default: sell most, reserve 40% for the grid, none to project yet
    market: { saturation: 0 },
    dispatch: { charge: 0, peakLeft: 0, nextPeakIn: 240 },
    grid: { vLevel: 0, aLevel: 0, rLevel: 0 },
    ...defaultTierTwistState(),
    credits: 0,
    puzzle: newPuzzle(0, rand),
    solvers: 0,
    solverProgress: 0,
    boosts: { surgeLeft: 0, powerLeft: 0, rpLeft: 0 },
    daily: { lastClaimDay: '', streak: 0 },
    achievements: [],
    lastSaved: now,
    stats: { lifetimePower: 0, ascensions: 0, startedAt: now, puzzlesSolved: 0 },
  };
  for (const src of buildSources(0)) s.sources[src.id] = src;
  for (const node of buildResearch()) s.research[node.id] = node;
  return s;
}
