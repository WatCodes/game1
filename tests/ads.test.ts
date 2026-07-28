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

  it('keeps testing mode on until the submission build', () => {
    // Flipping this early means looking at live ads on your own inventory.
    expect(ADS.testing).toBe(true);
  });
});
