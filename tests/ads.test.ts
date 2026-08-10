import { describe, expect, it } from 'vitest';
import { shouldGrantReward } from '../src/platform/ads';
import { ADS, TEST_AD_UNITS } from '../src/content/monetization';

describe('reward policy', () => {
  it('grants when the ad was actually watched', () => {
    expect(shouldGrantReward('rewarded')).toBe(true);
  });

  it('grants when ads cannot run at all', () => {
    // Web/PWA, plugin missing, no fill, offline. A player on the browser build
    // must never be worse off than one on native — that would punish them for
    // something entirely outside their control.
    expect(shouldGrantReward('unavailable')).toBe(true);
  });

  it('withholds only on an explicit early dismissal', () => {
    expect(shouldGrantReward('dismissed')).toBe(false);
  });
});

describe('test-unit guard', () => {
  it('lists both of Google’s public rewarded sample units', () => {
    // The Android id is still a placeholder, so this list is what stops it from
    // being served as live inventory if `testing` is flipped and it's forgotten.
    expect(TEST_AD_UNITS).toContain('ca-app-pub-3940256099942544/5224354917');
    expect(TEST_AD_UNITS).toContain('ca-app-pub-3940256099942544/1712485313');
  });

  it('ships real, correctly-shaped units on both platforms', () => {
    for (const unit of [ADS.rewardedIos, ADS.rewardedAndroid]) {
      expect(TEST_AD_UNITS).not.toContain(unit);
      // Unit ids use "/", App ids use "~" — pasting the wrong one is the single
      // easiest mistake here, and it fails silently at runtime.
      expect(unit).toMatch(/^ca-app-pub-\d+\/\d+$/);
    }
    // Both units must belong to the same publisher account.
    const pub = (id: string) => id.split('/')[0];
    expect(pub(ADS.rewardedAndroid)).toBe(pub(ADS.rewardedIos));
  });

  it('ships with testing mode off — this is the submission build', () => {
    /**
     * This assertion used to be `true`, and failing on the flip was its whole
     * job: it fired once, at the exact commit that archives for submission,
     * after TestFlight had verified the flow. That has now happened.
     *
     * Inverted rather than deleted, because the guard is still worth having in
     * the other direction. Going back to `true` on a shipped build sends *test*
     * traffic to the live ad network, which is a policy violation that can
     * suspend the AdMob account — and `TEST_AD_UNITS` above cannot catch it,
     * since that list only guards the unit ids, not the flag.
     *
     * If you are here because this test failed, you probably set `testing` back
     * to `true` to develop against test ads. That is correct locally and must
     * not reach a release build.
     */
    expect(ADS.testing).toBe(false);
  });
});
