/**
 * Runtime bridge to Capacitor.
 *
 * Deliberately dependency-free: native plugins are imported *by name at
 * runtime*, never at build time. That means
 *   - the web/PWA build neither bundles nor requires them,
 *   - `npm run build` works today with none of them installed,
 *   - installing them later needs no code change here.
 *
 * Everything degrades to a sensible web behaviour, so the game is always
 * playable in a browser.
 */

import { registerPlugin } from '@capacitor/core';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function cap(): CapacitorGlobal | undefined {
  return (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True only inside a real iOS/Android shell. */
export function isNative(): boolean {
  return cap()?.isNativePlatform?.() === true;
}

export function platformName(): 'ios' | 'android' | 'web' {
  const p = cap()?.getPlatform?.();
  return p === 'ios' || p === 'android' ? p : 'web';
}

/**
 * Get a bridge to a natively-registered Capacitor plugin, or null off-native.
 *
 * This replaces a dynamic `import(name)` that could never have worked in a
 * shipped build. With `@vite-ignore` and a variable specifier, Vite left
 * `import("@capacitor-community/admob")` verbatim in the bundle — and a
 * WebView cannot resolve a bare module specifier, so it threw
 * `Failed to resolve module specifier`, the catch swallowed it, and every ad
 * silently reported `unavailable`. Ads therefore never ran in any build,
 * including TestFlight, while looking healthy because a failed ad still grants
 * the reward.
 *
 * `registerPlugin` is a *name*-based proxy over the native bridge: it needs the
 * plugin's registered identifier ("AdMob"), not its npm package. So the plugin
 * JS and its web stub still stay out of the bundle — the property the old
 * dynamic import was reaching for — but the call now actually reaches native.
 *
 * `@capacitor/core` is imported statically and deliberately. It is the bridge,
 * not a native SDK: a few KB of proxy plumbing, no ad code, and it no-ops off
 * native. That is the one build-time import this file allows, and the reason
 * docs/NATIVE.md's "works with none of the native packages installed" claim now
 * carries a caveat.
 */
export function nativePlugin<T>(name: string): T | null {
  if (!isNative()) return null;
  return registerPlugin<T>(name);
}
