import { ADS, TEST_AD_UNITS } from '../content/monetization';
import { isNative, nativePlugin, platformName } from './native';

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

/**
 * Method names here must match the native plugin's `@objc func`s exactly —
 * `registerPlugin` proxies by name, so a typo fails at runtime, not at build.
 * Verified against the plugin's iOS sources, which register `identifier =
 * "AdMob"` and expose initialize / prepareRewardVideoAd / showRewardVideoAd.
 */
interface AdMobPlugin {
  initialize(opts?: unknown): Promise<void>;
  prepareRewardVideoAd(opts: unknown): Promise<unknown>;
  showRewardVideoAd(): Promise<{ type?: string; amount?: number } | undefined>;
}

let initialized = false;

/**
 * Refuse to serve a Google *sample* unit as live inventory.
 *
 * Shipping a test unit with `testing: false` sends test traffic to the real ad
 * network, which is a policy violation that can suspend an AdMob account. The
 * Android id is still a placeholder, so this is a live hazard rather than a
 * hypothetical one — and the cost of the guard is nil, because `unavailable`
 * already grants the player their reward (see `shouldGrantReward`).
 */
function misconfigured(adId: string): boolean {
  return !ADS.testing && TEST_AD_UNITS.includes(adId);
}

/**
 * Show a rewarded ad. Never throws and never blocks progression — every
 * failure path resolves to `unavailable`, which still grants the bonus.
 */
export async function showRewardedAd(): Promise<RewardResult> {
  // "AdMob" is the identifier the native plugin registers itself under, not an
  // npm package name — see nativePlugin().
  const adMob = nativePlugin<AdMobPlugin>('AdMob');
  if (!adMob) return 'unavailable';

  try {
    if (!initialized) {
      await adMob.initialize();
      initialized = true;
    }
    const adId = platformName() === 'ios' ? ADS.rewardedIos : ADS.rewardedAndroid;
    if (misconfigured(adId)) return 'unavailable'; // fail safe, still rewards
    await adMob.prepareRewardVideoAd({
      adId,
      isTesting: ADS.testing,
      // No advertising identifier, no ATT prompt — see ADS.nonPersonalized.
      npa: ADS.nonPersonalized,
    });
    const reward = await adMob.showRewardVideoAd();
    // The plugin resolves with a reward item when it was actually earned.
    return reward ? 'rewarded' : 'dismissed';
  } catch {
    return 'unavailable';
  }
}
