import type { GameState } from './types';
import { CONFIG } from '../content/config';
import { buildSources } from '../content/sources';
import { buildMegaproject } from '../content/megaprojects';
import { buildResearch } from '../content/research';

export const SAVE_VERSION = 1;

export function createInitialState(now: number = Date.now()): GameState {
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
    dispatchReadyAt: 0,
    lastSaved: now,
    stats: { lifetimePower: 0, ascensions: 0, startedAt: now },
  };
  for (const src of buildSources(0)) s.sources[src.id] = src;
  for (const node of buildResearch()) s.research[node.id] = node;
  return s;
}
