import { useEffect } from 'react';
import { tick } from '../../engine/loop';
import { game, publishDisplay, useGame } from '../../store/gameStore';
import { saveToStorage } from '../../store/save';
import { CONFIG } from '../../content/config';

const STEP = 1 / 20; // 20 Hz fixed-timestep simulation
const DISPLAY_HZ = 12;

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
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveToStorage(game);
        return;
      }
      // performance.now() kept advancing while rAF was parked, so rebase the
      // clock before crediting — otherwise the first frame back also bills a
      // (clamped) slice of a window the offline path has already paid out.
      last = performance.now();
      acc = 0;
      useGame.getState().actions.creditAwayTime();
    };
    // beforeunload is unreliable on iOS; pagehide is the one that actually
    // fires there. Both are cheap, and saving twice is harmless.
    const onUnload = () => saveToStorage(game);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(autosave);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);
}
