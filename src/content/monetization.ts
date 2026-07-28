// Monetization identifiers. Everything here is a PLACEHOLDER until the real
// accounts exist — see docs/NATIVE.md for exactly what to swap and where.

/** The app's bundle identifier — must match `appId` in capacitor.config.ts. */
export const APP_ID = 'com.watcodes.electriccats';

/**
 * AdMob **App** IDs (note the `~`, which is what distinguishes them from ad
 * *unit* ids, which use `/`). These are NOT consumed by any TypeScript here —
 * the Google SDK reads them from the native manifests, and it throws on launch
 * if they're absent. They live here so the values aren't lost between now and
 * the native build. See docs/NATIVE.md for exactly where they go:
 *
 *   iOS      ios/App/App/Info.plist        → GADApplicationIdentifier
 *   Android  android/app/src/main/AndroidManifest.xml
 *            → <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" …>
 */
export const ADMOB_APP_ID = {
  ios: 'ca-app-pub-2102762899981380~5611430610',
  android: 'ca-app-pub-2102762899981380~1867892655',
} as const;

export const ADS = {
  /**
   * Real rewarded units. Note the `/` — an id with a `~` is the *App* ID and
   * belongs in the native manifest instead (see ADMOB_APP_ID above).
   */
  rewardedIos: 'ca-app-pub-2102762899981380/9091279115',
  rewardedAndroid: 'ca-app-pub-2102762899981380/1096670800',
  /**
   * Test mode. **Leave `true` until the moment you archive for submission.**
   *
   * Both directions are dangerous, but only one is dangerous *now*: real units
   * with `testing: true` just serve test ads (safe), whereas `testing: false`
   * during development means YOU are looking at — and possibly tapping — live
   * ads on your own inventory, which is the classic way to get an AdMob account
   * suspended. So this flips last, not first.
   */
  testing: true,
  /**
   * Request NON-personalized ads only. This is a deliberate product/compliance
   * trade, not a default: personalized ads count as tracking, which would oblige
   * us to show Apple's App Tracking Transparency prompt, add a tracking usage
   * string, and declare tracking in App Privacy. Most users decline ATT anyway,
   * so the eCPM we give up is smaller than it looks — and in exchange the app
   * collects no advertising identifier, needs no ATT prompt, and has a much
   * simpler (and more honest) privacy story. Revisit only with a real reason.
   */
  nonPersonalized: true,
} as const;

/**
 * Google's public sample unit ids. Shipping one of these with `testing: false`
 * would send *test* traffic to the live ad network — a policy violation that can
 * suspend the account. Both real units are in place now, so this is a standing
 * tripwire rather than an active hazard: `ads.ts` checks the list and refuses to
 * serve, so a future placeholder can never quietly reach production.
 */
export const TEST_AD_UNITS: readonly string[] = [
  'ca-app-pub-3940256099942544/1712485313', // rewarded, iOS
  'ca-app-pub-3940256099942544/5224354917', // rewarded, Android
];

/**
 * Ads are rewarded-only, by design — Wyatt's brief: no interstitials, nothing
 * that interrupts. The player always opts in for something concrete.
 */
export const PRODUCTS = {
  removeAds: 'electriccats.removeads',
  creditsSmall: 'electriccats.credits.small',
  creditsLarge: 'electriccats.credits.large',
} as const;
