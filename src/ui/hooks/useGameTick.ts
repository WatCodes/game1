import { useEffect } from 'react';
import { tick } from '../../engine/loop';
import { game, publishDisplay, useGame } from '../../store/gameStore';
import { saveToStorage } from '../../store/save';
import { CONFIG } from '../../content/config';
import { nativePlugin } from '../../platform/native';

const STEP = 1 / 20; // 20 Hz fixed-timestep simulation
const DISPLAY_HZ = 12;

/**
 * The sliver of @capacitor/app this file uses.
 *
 * Declared locally rather than imported from the package, matching the rule in
 * platform/native.ts: native plugins are reached by *name* through the bridge so
 * the web build neither bundles nor requires them. The package is still a real
 * dependency — it carries the native implementation that `cap sync` installs —
 * but nothing from it reaches the browser bundle.
 */
interface AppStatePlugin {
  addListener(
    event: 'appStateChange',
    cb: (state: { isActive: boolean }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

/**
 * Drives the fixed-timestep loop and publishes the throttled display snapshot
 * (ARCHITECTURE §2). Also owns autosave. Mount exactly once, in App.
 */
export function useGameTick(): void {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let disp = 0;

    const frame = (now: number) => {
      let dt = (now - last) / 1000;
      last = now;
      dt = Math.min(dt, 0.25); // clamp after tab-away; offline handles long gaps
      acc += dt;
      while (acc >= STEP) {
        tick(game, STEP);
        acc -= STEP;
      }
      disp += dt;
      if (disp >= 1 / DISPLAY_HZ) {
        publishDisplay();
        disp = 0;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // A save that silently stops working is the worst failure this game has:
    // the player keeps playing, everything looks fine, and the session is gone
    // when they close the app. Tell them the moment it happens.
    const autosave = window.setInterval(() => {
      if (!saveToStorage(game)) useGame.getState().actions.reportSaveFailure();
    }, CONFIG.AUTOSAVE_INTERVAL_MS);

    /**
     * Hiding saves (stamping `lastSaved`, which marks the start of the away
     * window); showing credits the span that just elapsed.
     *
     * The show half matters more than it looks: a phone suspends the WebView
     * instead of unloading it, so nothing else in the app ever notices that
     * hours passed. rAF is paused throughout, so no simulation happened.
     */
    const onHide = () => saveToStorage(game);
    const onShow = () => {
      // performance.now() kept advancing while rAF was parked, so rebase the
      // clock before crediting — otherwise the first frame back also bills a
      // (clamped) slice of a window the offline path has already paid out.
      last = performance.now();
      acc = 0;
      useGame.getState().actions.creditAwayTime();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        onHide();
        return;
      }
      onShow();
    };
    // beforeunload is unreliable on iOS; pagehide is the one that actually
    // fires there. Both are cheap, and saving twice is harmless.
    const onUnload = () => saveToStorage(game);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);

    /**
     * The native half of the same signal.
     *
     * `visibilitychange` is the correct web event and fires reliably in a
     * browser, but iOS does not dependably deliver it to a WKWebView when the
     * *app* is backgrounded — only when the page itself is hidden. So switching
     * to another app often produced no event at all, and away time was credited
     * only after a full swipe-kill, which is the much rarer action. Players
     * reported the game "not going offline unless you fully close it", and they
     * were right.
     *
     * Capacitor's App plugin reports the native lifecycle directly. Both paths
     * stay wired: creditAwayTime is idempotent per window (creditOffline
     * advances `lastSaved` before paying out), so a device that fires both
     * cannot double-credit.
     */
    let removeAppState: (() => void) | undefined;
    const appPlugin = nativePlugin<AppStatePlugin>('App');
    void appPlugin
      ?.addListener('appStateChange', ({ isActive }) => {
        if (isActive) onShow();
        else onHide();
      })
      .then((handle) => {
        removeAppState = () => void handle.remove();
      })
      .catch(() => {
        // Plugin missing or the bridge refused — the web listeners still cover
        // browsers, and this is a degradation rather than a failure.
      });

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(autosave);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
      removeAppState?.();
    };
  }, []);
}
