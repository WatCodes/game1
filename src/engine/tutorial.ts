import { CONFIG } from '../content/config';
import { MOMENT_ORDER, type MomentId } from '../content/tutorial';
import type { GameState } from './types';
import { powerPerSec } from './economy';
import { isResearchAvailable } from './research';
import { megaprojectProgress } from './megaproject';

/**
 * Which tutorial moment the game state calls for. Design: docs/TUTORIAL.md.
 *
 * Pure, and deliberately unaware of what the player has already *seen* — that
 * lives in UI storage, not the save. This file answers one question: given the
 * state, would this beat be useful right now?
 *
 * Every condition includes "has not already done the thing". The app is live, and
 * a player three hours in must never be told what Credits are; these gates are
 * what stop that, since a returning player's device has no seen flags at all.
 */

const owned = (s: GameState): number =>
  Object.values(s.sources).reduce((n, src) => n + src.owned, 0);

const anyResearchBought = (s: GameState): boolean =>
  Object.values(s.research).some((n) => n.purchased);

const anyResearchAffordable = (s: GameState): boolean =>
  Object.values(s.research).some((n) => isResearchAvailable(s, n) && s.rp >= n.cost);

/** Never ascended. Everything the tutorial teaches is first-run material. */
const firstRun = (s: GameState): boolean => s.stats.ascensions === 0;

export function momentDue(s: GameState, id: MomentId): boolean {
  switch (id) {
    case 'credits':
      // Nothing ever generated, not merely nothing owned: after an ascension a
      // veteran also owns nothing, and must not be taught to buy a kneader.
      return firstRun(s) && s.stats.lifetimePower === 0 && owned(s) === 0;
    case 'altar':
      // Only when tapping it would actually work — the lesson of the 1.0.1
      // Channel fix. Dispatch sells a slice of generation, so it needs both
      // generation and charge.
      return (
        firstRun(s) &&
        s.stats.lifetimePower < CONFIG.TUTORIAL_ALTAR_MAX_LIFETIME &&
        powerPerSec(s) > 0 &&
        s.dispatch.charge >= CONFIG.DISPATCH_MIN_CHARGE
      );
    case 'research':
      return !anyResearchBought(s) && anyResearchAffordable(s);
    case 'kp':
      return firstRun(s) && s.kp === 0 && megaprojectProgress(s) >= CONFIG.TUTORIAL_KP_PROGRESS;
  }
}

/**
 * Whether a `do` beat's action has been performed, from state alone.
 *
 * The altar returns false: the game keeps no record of a channel, so the UI
 * notices the dispatch itself. `tell` beats are finished by a tap, not by state.
 */
export function momentSatisfied(s: GameState, id: MomentId): boolean {
  switch (id) {
    case 'credits':
      return owned(s) > 0;
    case 'research':
      return anyResearchBought(s);
    case 'altar':
    case 'kp':
      return false;
  }
}

/** Snapshot for the display layer: React reads this, never the state itself. */
export function tutorialSnapshot(s: GameState): {
  due: Record<MomentId, boolean>;
  satisfied: Record<MomentId, boolean>;
} {
  const due = {} as Record<MomentId, boolean>;
  const satisfied = {} as Record<MomentId, boolean>;
  for (const id of MOMENT_ORDER) {
    due[id] = momentDue(s, id);
    satisfied[id] = momentSatisfied(s, id);
  }
  return { due, satisfied };
}
