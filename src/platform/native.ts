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
 * Load a Capacitor plugin by module name, or null if unavailable. The
 * specifier is a variable so the bundler leaves it alone — a literal would
 * make Vite try to resolve a package that isn't installed yet.
 */
export async function loadPlugin<T>(name: string): Promise<T | null> {
  if (!isNative()) return null;
  try {
    return (await import(/* @vite-ignore */ name)) as T;
  } catch {
    return null; // plugin not installed in this build
  }
}
