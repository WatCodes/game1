// Monetization identifiers. Everything here is a PLACEHOLDER until the real
// accounts exist — see docs/NATIVE.md for exactly what to swap and where.

export const APP_ID = 'com.watcodes.electriccats';

export const ADS = {
  /**
   * Google's official public TEST rewarded unit. Safe to ship in development;
   * swap for the real AdMob unit ids before submitting, and set testing:false.
   * Using real units with testing:true (or test units in production) is what
   * gets AdMob accounts suspended, so these two move together.
   */
  rewardedIos: 'ca-app-pub-3940256099942544/1712485313',
  rewardedAndroid: 'ca-app-pub-3940256099942544/5224354917',
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
 * Ads are rewarded-only, by design — Wyatt's brief: no interstitials, nothing
 * that interrupts. The player always opts in for something concrete.
 */
export const PRODUCTS = {
  removeAds: 'electriccats.removeads',
  creditsSmall: 'electriccats.credits.small',
  creditsLarge: 'electriccats.credits.large',
} as const;
