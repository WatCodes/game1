import type { GameState } from './types';
import { CONFIG } from '../content/config';
import { buildSources } from '../content/sources';
import { buildMegaproject } from '../content/megaprojects';
import { buildResearch } from '../content/research';
import { newPuzzle } from './puzzle';
import { defaultTierTwistState } from './tierTwists';

export const SAVE_VERSION = 9;

export function createInitialState(now: number = Date.now(), rand: () => number = Math.random): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    tier: 0,
    power: 0, // the Watt bank is retired (§3.15) — money is CR
    runPower: 0,
    rp: 0,
    kp: 0,
    sources: {},
    research: {},
    megaproject: buildMegaproject(0),
    routePct: 0,
    sellPct: 0.6, // default: sell most, reserve 40% for the grid, none to project yet
    market: { saturation: 0, index: CONFIG.INDEX_MEAN, indexHistory: [], sampleIn: 0 },
    reserve: { stored: 0, avgPrice: 0 },
    dispatch: { charge: 0, peakLeft: 0, nextPeakIn: 240 },
    // No offer waiting at the door. The first one is a full gap away, so a new
    // player meets the game before they meet an ad prompt.
    ads: {
      boostCooldown: 0,
      nextOfferIn: CONFIG.AD_OFFER_GAP_MAX_SECONDS,
      offer: null,
      offerLeft: 0,
    },
    grid: { vLevel: 0, aLevel: 0, rLevel: 0 },
    ...defaultTierTwistState(),
    // Enough to afford the first generator. Without this a new game is
    // unwinnable: no sources → no generation → no CR → no sources.
    credits: CONFIG.STARTING_CREDITS,
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
