import { describe, expect, it } from 'vitest';
import { shouldGrantReward } from '../src/platform/ads';

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
