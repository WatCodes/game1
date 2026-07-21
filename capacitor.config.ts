/**
 * Native shell config. The web build in `dist/` IS the app — Capacitor only
 * wraps it, so `npm run build` must run before `npx cap sync`.
 *
 * Intentionally untyped and importing nothing: @capacitor/cli is not a
 * dependency yet, and a typed import would break `npm run build` for everyone
 * until it is. Add `import type { CapacitorConfig } from '@capacitor/cli'`
 * once the packages are installed if you want the type checking.
 *
 * `appId` must match APP_ID in src/content/monetization.ts.
 * Full first-time setup (accounts, ad ids, signing): docs/NATIVE.md
 */
const config = {
  appId: 'com.watcodes.electriccats',
  appName: 'Electric Cats',
  webDir: 'dist',
  // Dark shell everywhere so there's no white flash before the app paints.
  backgroundColor: '#04070e',
  ios: {
    contentInset: 'never',
    backgroundColor: '#04070e',
  },
  android: {
    backgroundColor: '#04070e',
  },
};

export default config;
