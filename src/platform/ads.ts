import { ADS } from '../content/monetization';
import { isNative, loadPlugin, platformName } from './native';

export type RewardResult = 'rewarded' | 'dismissed' | 'unavailable';

/**
 * Product rule, kept pure so it can be tested and argued about separately from
 * the SDK: we never punish a player for something outside their control.
 *
 * - `rewarded`   → they watched it. Grant.
 * - `unavailable`→ web build, no plugin, no fill, network down. Grant anyway;
 *                  a player on the PWA must not be worse off than a native one.
 * - `dismissed`  → they actively closed the ad early. Only this withholds.
 */
export function shouldGrantReward(result: RewardResult): boolean {
  return result !== 'dismissed';
}

/** True when a real rewarded ad can plausibly be shown (drives UI wording). */
export function adsAvailable(): boolean {
  return isNative();
}

interface AdMobPlugin {
  AdMob: {
    initialize(opts?: unknown): Promise<void>;
    prepareRewardVideoAd(opts: unknown): Promise<unknown>;
    showRewardVideoAd(): Promise<{ type?: string; amount?: number } | undefined>;
  };
}

let initialized = false;

/**
 * Show a rewarded ad. Never throws and never blocks progression — every
 * failure path resolves to `unavailable`, which still grants the bonus.
 */
export async function showRewardedAd(): Promise<RewardResult> {
  const plugin = await loadPlugin<AdMobPlugin>('@capacitor-community/admob');
  if (!plugin?.AdMob) return 'unavailable';

  try {
    if (!initialized) {
      await plugin.AdMob.initialize();
      initialized = true;
    }
    const adId = platformName() === 'ios' ? ADS.rewardedIos : ADS.rewardedAndroid;
    await plugin.AdMob.prepareRewardVideoAd({ adId, isTesting: ADS.testing });
    const reward = await plugin.AdMob.showRewardVideoAd();
    // The plugin resolves with a reward item when it was actually earned.
    return reward ? 'rewarded' : 'dismissed';
  } catch {
    return 'unavailable';
  }
}
