import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/engine/state';
import { acceptOffer, canWatchForBoost, clearOffer, grantAdBoost, tickAdOffers } from '../src/engine/adOffers';
import { hydrate, serialize, validateSave } from '../src/store/save';
import { CONFIG } from '../src/content/config';
import type { GameState } from '../src/engine/types';

/** A state with the offer clock already expired, so one surfaces on the next tick. */
function ready(): GameState {
  const s = createInitialState(0);
  s.ads.nextOfferIn = 0;
  return s;
}

describe('ad-funded boosts', () => {
  it('starts available and pays the same boost the shop sells', () => {
    const s = createInitialState(0);
    expect(canWatchForBoost(s)).toBe(true);
    expect(grantAdBoost(s, 'power')).toBe(true);
    expect(s.boosts.powerLeft).toBe(CONFIG.BOOST_SECONDS);
    expect(s.credits).toBe(CONFIG.STARTING_CREDITS); // free — an ad replaces the price
  });

  it('cannot be stacked by tapping twice', () => {
    // A double-tap, or a replayed reward callback, must not compound.
    const s = createInitialState(0);
    expect(grantAdBoost(s, 'rp')).toBe(true);
    expect(grantAdBoost(s, 'rp')).toBe(false);
    expect(s.boosts.rpLeft).toBe(CONFIG.BOOST_SECONDS);
  });

  it('comes back after the cooldown elapses', () => {
    const s = createInitialState(0);
    grantAdBoost(s, 'power');
    expect(canWatchForBoost(s)).toBe(false);
    tickAdOffers(s, CONFIG.AD_BOOST_COOLDOWN_SECONDS);
    expect(canWatchForBoost(s)).toBe(true);
  });
});

describe('the standing offer', () => {
  it('does not greet a brand-new player', () => {
    // Meeting an ad prompt before meeting the game is the wrong first beat.
    const s = createInitialState(0);
    expect(s.ads.offer).toBeNull();
    expect(s.ads.nextOfferIn).toBeGreaterThan(0);
  });

  it('surfaces once the gap elapses', () => {
    const s = ready();
    tickAdOffers(s, 1, () => 0.1);
    expect(s.ads.offer).toBe('power');
    expect(s.ads.offerLeft).toBe(CONFIG.AD_OFFER_LIFETIME_SECONDS);
  });

  it('withdraws itself when ignored rather than nagging', () => {
    const s = ready();
    tickAdOffers(s, 1, () => 0.1);
    tickAdOffers(s, CONFIG.AD_OFFER_LIFETIME_SECONDS);
    expect(s.ads.offer).toBeNull();
    expect(s.ads.nextOfferIn).toBeGreaterThan(0);
  });

  it('never appears while the boost is still on cooldown', () => {
    // An offer the player can see but not take is worse than no offer.
    const s = ready();
    grantAdBoost(s, 'power'); // starts the cooldown
    tickAdOffers(s, 1, () => 0.1);
    expect(s.ads.offer).toBeNull();
  });

  it('pays out when accepted, and starts the cooldown', () => {
    const s = ready();
    tickAdOffers(s, 1, () => 0.9); // rand >= 0.5 → rp
    expect(s.ads.offer).toBe('rp');
    expect(acceptOffer(s)).toBe('rp');
    expect(s.boosts.rpLeft).toBe(CONFIG.BOOST_SECONDS);
    expect(s.ads.offer).toBeNull();
    expect(canWatchForBoost(s)).toBe(false);
  });

  it('costs nothing to dismiss', () => {
    const s = ready();
    tickAdOffers(s, 1, () => 0.1);
    const credits = s.credits;
    clearOffer(s);
    expect(s.ads.offer).toBeNull();
    expect(s.credits).toBe(credits);
    expect(canWatchForBoost(s)).toBe(true); // refusing costs no cooldown either
  });

  it('accepting nothing returns null rather than paying out', () => {
    const s = createInitialState(0);
    expect(acceptOffer(s)).toBeNull();
    expect(s.boosts.powerLeft).toBe(0);
    expect(s.boosts.rpLeft).toBe(0);
  });
});

describe('save compatibility', () => {
  it('loads a pre-1.0.1 save that has no ads field at all', () => {
    /**
     * The case that matters most: the app is live, so every existing player's
     * save predates this field. Losing those saves to a validator that suddenly
     * demands `ads` would be far worse than shipping no ad placements at all.
     */
    const s = createInitialState(0);
    const raw = JSON.parse(JSON.stringify(serialize(s))) as Record<string, unknown>;
    delete raw.ads;
    const loaded = hydrate(validateSave(raw));
    expect(loaded.ads.offer).toBeNull();
    expect(loaded.ads.boostCooldown).toBe(0);
    expect(loaded.ads.nextOfferIn).toBeGreaterThan(0);
  });

  it('round-trips the cooldown so it cannot be reset by relaunching', () => {
    const s = createInitialState(0);
    grantAdBoost(s, 'power');
    const loaded = hydrate(validateSave(JSON.parse(JSON.stringify(serialize(s)))));
    expect(loaded.ads.boostCooldown).toBeCloseTo(CONFIG.AD_BOOST_COOLDOWN_SECONDS);
    expect(canWatchForBoost(loaded)).toBe(false);
  });

  it('never restores a stale offer from disk', () => {
    // An offer revived from a save written hours ago would ambush the player on
    // return — the interruption the store listing promises does not happen.
    const s = ready();
    tickAdOffers(s, 1, () => 0.1);
    expect(s.ads.offer).not.toBeNull();
    const loaded = hydrate(validateSave(JSON.parse(JSON.stringify(serialize(s)))));
    expect(loaded.ads.offer).toBeNull();
  });
});
