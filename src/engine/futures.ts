import type { FuturesPosition, GameState, Num } from './types';
import { CONFIG } from '../content/config';
import { marketIndex } from './market';
import { isUnlocked } from './unlocks';

/**
 * The Futures Desk (Agora). Stake Credits on where the **demand index** goes
 * over a fixed window.
 *
 * Why the index and not the delivered price: the price is
 * `BASE / (1 + saturation) × index`, and saturation is driven entirely by the
 * player's own Sell slider. A bet on the price could therefore be won every
 * single time — place it, then move the slider. The index is exogenous, so the
 * bet is a real one.
 *
 * It is deliberately a **net sink**: FUTURES_PAYOUT is below 2, so a coin-flip
 * bettor loses value over time. Speculation is somewhere to put a surplus, never
 * the best way to earn — the grid is always the better business.
 *
 * No real money is involved anywhere: stakes are Credits earned by playing, and
 * Credits are not sold. Keep it that way; pairing a currency sale with a wager
 * on that currency is what turns this into a regulated loot box.
 */

export function futuresUnlocked(s: GameState): boolean {
  return isUnlocked(s, 'board') && s.stats.lifetimePower >= CONFIG.UNLOCK_FUTURES_POWER;
}

/** Most a player may commit right now — capped as a share of the balance so a
 *  single tap can never be an all-in. */
export function maxStake(s: GameState): Num {
  return Math.floor(Math.max(0, s.credits) * CONFIG.FUTURES_MAX_STAKE_FRACTION);
}

export function canPlaceFuture(s: GameState, stake: Num): boolean {
  if (!futuresUnlocked(s) || s.futures) return false;
  if (!Number.isFinite(stake)) return false;
  return stake >= CONFIG.FUTURES_MIN_STAKE && stake <= maxStake(s) && stake <= s.credits;
}

/** Commit a stake. Credits leave immediately, so an open position is money
 *  already spent — settlement can only ever pay back in. */
export function placeFuture(s: GameState, stake: Num, up: boolean): boolean {
  const amount = Math.floor(stake);
  if (!canPlaceFuture(s, amount)) return false;
  s.credits -= amount;
  s.futures = {
    stake: amount,
    up,
    entryIndex: marketIndex(s),
    secondsLeft: CONFIG.FUTURES_WINDOW_SECONDS,
  };
  return true;
}

export interface FuturesSettlement {
  position: FuturesPosition;
  exitIndex: number;
  won: boolean;
  payout: Num; // 0 on a loss, stake × FUTURES_PAYOUT on a win
}

/**
 * Advance an open position and settle it when the window closes. Returns the
 * settlement exactly once, on the tick that resolves it, so the caller can toast
 * it; null otherwise.
 *
 * An exactly-unchanged index counts as a loss for an `up` bet (strict >), which
 * is the honest reading of "will it rise" and avoids paying out on no movement.
 */
export function tickFutures(s: GameState, dt: number): FuturesSettlement | null {
  const pos = s.futures;
  if (!pos) return null;
  pos.secondsLeft -= dt;
  if (pos.secondsLeft > 0) return null;

  const exitIndex = marketIndex(s);
  const rose = exitIndex > pos.entryIndex;
  const won = pos.up === rose && exitIndex !== pos.entryIndex;
  const payout = won ? pos.stake * CONFIG.FUTURES_PAYOUT : 0;
  s.credits += payout;
  s.futures = null;
  return { position: pos, exitIndex, won, payout };
}
