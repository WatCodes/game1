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
  // Parchment shell everywhere, matching --bg. These were #04070e from the old
  // dark theme, which meant every launch flashed near-black before the Marble &
  // Gold app painted — it read as a crash on slower devices.
  backgroundColor: '#f3ead4',
  ios: {
    contentInset: 'never',
    backgroundColor: '#f3ead4',
  },
  android: {
    backgroundColor: '#f3ead4',
  },
  plugins: {
    // The app is light, so the status bar needs DARK glyphs. Capacitor's naming
    // is the opposite of what you'd guess: Style.Light means "dark text, for
    // light backgrounds". Ignored unless @capacitor/status-bar is installed
    // (it's in `npm run native:install`).
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#f3ead4',
      overlaysWebView: false,
    },
  },
};

export default config;
