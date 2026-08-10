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

let initPromise: Promise<void> | null = null;

/**
 * Start the ad SDK as early as possible, and exactly once.
 *
 * The native `initialize` calls `MobileAds.shared.start(completionHandler: nil)`
 * and resolves immediately — it does not wait for the SDK to actually come up.
 * Initialising lazily at the first ad therefore fired a load microseconds after
 * start, which a simulator is fast enough to survive and a real device on a cold
 * network is not: the load rejected with "Loading failed", our catch turned that
 * into `unavailable`, and the player silently got their reward with no ad.
 *
 * Called at app launch, the SDK has the entire session to warm up before the
 * away summary can even appear (it needs two minutes of absence).
 */
export function initAds(): void {
  if (initPromise) return;
  const adMob = nativePlugin<AdMobPlugin>('AdMob');
  if (!adMob) return;
  initPromise = adMob.initialize().catch(() => {
    // Let the next ad attempt try again rather than latching a failure.
    initPromise = null;
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Load an ad, retrying a transient failure.
 *
 * "Loading failed" covers both "no fill" and "SDK not ready yet", and the two
 * are indistinguishable from here. A couple of short retries costs nothing on
 * the happy path and rescues the case where the player opened the summary
 * before the SDK finished starting.
 */
async function prepareWithRetry(adMob: AdMobPlugin, opts: unknown): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await adMob.prepareRewardVideoAd(opts);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < 2) await delay(800 * (attempt + 1));
    }
  }
  throw lastError;
}

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
    // Normally already resolved from launch; awaited here so a first ad still
    // works if initAds() was never reached.
    initAds();
    await initPromise;

    const adId = platformName() === 'ios' ? ADS.rewardedIos : ADS.rewardedAndroid;
    if (misconfigured(adId)) return 'unavailable'; // fail safe, still rewards
    await prepareWithRetry(adMob, {
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
