import { CONFIG } from '../content/config';
import type { GameState, Num } from './types';
import { gridPrice } from './market';

/** Fresh per-run twist state — used on init and on every ascension. */
export function defaultTierTwistState(): Pick<GameState, 'launchWindow' | 'accretion' | 'relay'> {
  return {
    launchWindow: { active: false, timeLeft: 0, nextIn: CONFIG.LAUNCH_GAP_MIN_SECONDS },
    accretion: { feedRate: 0, heat: 0 },
    relay: { researchAllocation: 0 },
  };
}

// One small mechanical twist per tier so late tiers aren't just the same
// loop with new skins (GAME_DESIGN §8 design risk). Each is inert outside
// its own tier and resets on ascension like other run-scoped state.

// ---------------------------------------------------------------------------
// T3 Orbital — Launch Windows. Periodic windows during which orbital source
// purchases avoid a cost surcharge. Pressure without a wall: automation still
// buys off-window, just less efficiently — nothing ever blocks.
// ---------------------------------------------------------------------------

export function launchCostMult(s: GameState): number {
  if (s.tier !== 3) return 1;
  return s.launchWindow.active ? 1 : CONFIG.LAUNCH_SURCHARGE;
}

export function tickLaunchWindow(s: GameState, dt: number, rand: () => number = Math.random): void {
  if (s.tier !== 3) return;
  const w = s.launchWindow;
  if (w.active) {
    w.timeLeft = Math.max(0, w.timeLeft - dt);
    if (w.timeLeft <= 0) {
      w.active = false;
      w.nextIn = CONFIG.LAUNCH_GAP_MIN_SECONDS + rand() * (CONFIG.LAUNCH_GAP_MAX_SECONDS - CONFIG.LAUNCH_GAP_MIN_SECONDS);
    }
  } else {
    w.nextIn = Math.max(0, w.nextIn - dt);
    if (w.nextIn <= 0) {
      w.active = true;
      w.timeLeft = CONFIG.LAUNCH_WINDOW_DURATION_SECONDS;
    }
  }
}

// ---------------------------------------------------------------------------
// T5 Exotic — Accretion Disk. Player-chosen feed rate trades upkeep for
// output; heat builds proportionally and maxing it out fires a one-off power
// flare. Purely upside and timing-based — never an RNG punishment.
// ---------------------------------------------------------------------------

export function setFeedRate(s: GameState, rate: number): void {
  s.accretion.feedRate = Math.max(0, Math.min(1, rate));
}

export function accretionOutputMult(s: GameState): number {
  return s.tier === 5 ? 1 + s.accretion.feedRate * CONFIG.ACCRETION_OUTPUT_BONUS : 1;
}

export function accretionUpkeepMult(s: GameState): number {
  return s.tier === 5 ? 1 + s.accretion.feedRate * CONFIG.ACCRETION_UPKEEP_PENALTY : 1;
}

export interface FlareResult {
  gained: Num; // power released by the flare (W)
  creditsGained: Num; // CR from selling that burst at the current grid price
}

/** Advance heat by feed rate; fires a flare (burst of power sold for CR) at 100%. */
export function tickAccretion(s: GameState, dt: number, pps: Num): FlareResult | null {
  if (s.tier !== 5 || s.accretion.feedRate <= 0) return null;
  s.accretion.heat = Math.min(1, s.accretion.heat + (s.accretion.feedRate * dt) / CONFIG.ACCRETION_HEAT_SECONDS);
  if (s.accretion.heat < 1) return null;
  s.accretion.heat = 0;
  const gained = pps * CONFIG.ACCRETION_FLARE_SECONDS;
  if (gained <= 0) return null;
  const creditsGained = gained * gridPrice(s);
  s.credits += creditsGained;
  s.runPower += gained;
  s.stats.lifetimePower += gained;
  return { gained, creditsGained };
}

// ---------------------------------------------------------------------------
// T6 Galactic — Relay Routing. Divert a share of the relay network from power
// delivery to the research array. A straight power<->RP trade (not a raw
// currency conversion) so the lever can't silently dominate either resource.
// ---------------------------------------------------------------------------

export function setRelayAllocation(s: GameState, pct: number): void {
  s.relay.researchAllocation = Math.max(0, Math.min(1, pct));
}

export function relayPowerMult(s: GameState): number {
  return s.tier === 6 ? 1 - s.relay.researchAllocation * CONFIG.RELAY_POWER_PENALTY : 1;
}

export function relayRpMult(s: GameState): number {
  return s.tier === 6 ? 1 + s.relay.researchAllocation * CONFIG.RELAY_RP_BONUS : 1;
}
