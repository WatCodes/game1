import { CONFIG } from '../content/config';
import type { AdOfferKind, GameState } from './types';

/**
 * Pacing and payout for rewarded-ad placements.
 *
 * The hard constraint this module exists to respect: the App Store description
 * promises "No forced ads, ever. No timers blocking your progress." So nothing
 * here shows an ad, blocks play, or gates progress. It only decides *when an
 * opt-in offer is allowed to exist*, and what taking one is worth.
 *
 * Two placements, both voluntary:
 *
 *   1. A standing "watch for a free boost" control in the shop, rate-limited by
 *      `boostCooldown` so it is a periodic treat rather than an infinite tap.
 *   2. An offer that surfaces on its own every so often, sits quietly, and
 *      withdraws itself if ignored. It is a suggestion, never a modal.
 *
 * Both pay the *same* boost the shop already sells for Credits, deliberately. An
 * ad is a shortcut past a price, never a route to something otherwise
 * unobtainable — that keeps the game honest for a player who never watches one.
 */

/** True when the free ad-funded boost is off cooldown. */
export function canWatchForBoost(s: GameState): boolean {
  return s.ads.boostCooldown <= 0;
}

/**
 * Grant the boost an ad was watched for, and start the cooldown.
 *
 * Returns false if the cooldown has not elapsed, so a double-tap or a replayed
 * callback cannot stack boosts. The caller is responsible for having actually
 * shown (or legitimately failed to show) an ad first — `shouldGrantReward`
 * decides that, and deliberately grants when ads are unavailable so a player on
 * the web build is never worse off.
 */
export function grantAdBoost(s: GameState, kind: AdOfferKind): boolean {
  if (!canWatchForBoost(s)) return false;
  if (kind === 'power') s.boosts.powerLeft += CONFIG.BOOST_SECONDS;
  else s.boosts.rpLeft += CONFIG.BOOST_SECONDS;
  s.ads.boostCooldown = CONFIG.AD_BOOST_COOLDOWN_SECONDS;
  return true;
}

/** Take the standing offer: same payout, and it clears the offer. */
export function acceptOffer(s: GameState): AdOfferKind | null {
  const kind = s.ads.offer;
  if (!kind) return null;
  clearOffer(s);
  // Deliberately not gated on the cooldown. The offer only *appears* when the
  // cooldown is clear, and refusing it here would mean an offer the player can
  // see and cannot take.
  if (kind === 'power') s.boosts.powerLeft += CONFIG.BOOST_SECONDS;
  else s.boosts.rpLeft += CONFIG.BOOST_SECONDS;
  s.ads.boostCooldown = CONFIG.AD_BOOST_COOLDOWN_SECONDS;
  return kind;
}

/** Dismiss without watching. Costs nothing and re-arms the normal gap. */
export function clearOffer(s: GameState): void {
  s.ads.offer = null;
  s.ads.offerLeft = 0;
  s.ads.nextOfferIn = offerGap(() => 0.5);
}

function offerGap(rand: () => number): number {
  const { AD_OFFER_GAP_MIN_SECONDS: min, AD_OFFER_GAP_MAX_SECONDS: max } = CONFIG;
  return min + rand() * (max - min);
}

/**
 * Advance the ad clocks by `dt` seconds.
 *
 * An offer surfaces only when the boost cooldown is already clear, so the player
 * is never shown something they cannot act on. Ignoring it withdraws it — an
 * offer that waits forever becomes wallpaper, and one that nags becomes the
 * forced ad the listing says does not exist.
 */
export function tickAdOffers(s: GameState, dt: number, rand: () => number = Math.random): void {
  const a = s.ads;
  a.boostCooldown = Math.max(0, a.boostCooldown - dt);

  if (a.offer) {
    a.offerLeft -= dt;
    if (a.offerLeft <= 0) clearOffer(s);
    return;
  }

  a.nextOfferIn -= dt;
  if (a.nextOfferIn > 0) return;
  if (a.boostCooldown > 0) {
    // Cooldown outlasted the gap; wait rather than queue an untakeable offer.
    a.nextOfferIn = a.boostCooldown;
    return;
  }
  a.offer = rand() < 0.5 ? 'power' : 'rp';
  a.offerLeft = CONFIG.AD_OFFER_LIFETIME_SECONDS;
}
