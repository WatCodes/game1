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

  it('does not ship a sample unit as the real iOS unit', () => {
    // iOS is the platform v1 launches on; this must be a genuine unit.
    expect(TEST_AD_UNITS).not.toContain(ADS.rewardedIos);
    expect(ADS.rewardedIos).toMatch(/^ca-app-pub-\d+\/\d+$/); // unit ids use "/", app ids use "~"
  });

  it('keeps testing mode on until the submission build', () => {
    // Flipping this early means looking at live ads on your own inventory.
    expect(ADS.testing).toBe(true);
  });
});
