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

    /**
     * `lastSaved` means "the game state is accurate as of this moment", and only
     * the simulation may advance it.
     *
     * It used to be restamped by *every* save, including the 8-second autosave.
     * That conflated "when the file was written" with "how far the simulation has
     * run", and the two come apart whenever the loop pauses but JavaScript does
     * not: rAF stops for an app that is not visible, while timers can keep going.
     * The autosave then kept stamping "now" over a state that was frozen in time,
     * so on return the away window read as a few seconds and the time was simply
     * lost — no credit, no summary. Playtesters hit it on device.
     *
     * Reproduced on the iOS Simulator two ways: a resume where the overdue
     * autosave beat the lifecycle event and erased the window (RP barely moved;
     * the very next identical attempt showed +33 RP), and a backgrounding where
     * the app was never frozen at all and every resume arrived with a 0.2–5s gap
     * after 125s away. Same cause both times.
     *
     * So the frame loop stamps the clock after it simulates, and saves that can
     * run while the loop is paused — autosave, hide, unload — persist that stamp
     * rather than minting a new one. A paused loop can no longer hide time from
     * anyone, whatever order events arrive in. Saves from the store stay as they
     * were: they follow a tap, which means the loop is live and "now" is already
     * accurate.
     */
    const persist = () => saveToStorage(game, game.lastSaved);
    const onHide = persist;
    const onShow = () => {
      // performance.now() kept advancing while rAF was parked, so rebase the
      // clock before crediting — otherwise the first frame back also bills a
      // (clamped) slice of a window the offline path has already paid out.
      last = performance.now();
      acc = 0;
      useGame.getState().actions.creditAwayTime();
    };

    /**
     * The first frame after any pause checks how long the loop was stopped and
     * credits it. This is what makes crediting independent of lifecycle events:
     * if neither visibilitychange nor appStateChange arrives, the next frame
     * still notices. Idempotent with them — creditOffline advances `lastSaved`
     * as it pays, so whichever runs second finds nothing left.
     */
    const catchUp = (): boolean => {
      if (Date.now() - game.lastSaved < CONFIG.OFFLINE_MIN_SECONDS * 1000) return false;
      onShow();
      return true;
    };

    const frame = (now: number) => {
      if (catchUp()) {
        // onShow just rebased `last`; skip simulating this stale frame.
        raf = requestAnimationFrame(frame);
        return;
      }
      let dt = (now - last) / 1000;
      last = now;
      dt = Math.min(dt, 0.25); // clamp after tab-away; offline handles long gaps
      acc += dt;
      while (acc >= STEP) {
        tick(game, STEP);
        acc -= STEP;
      }
      // The state is now accurate as of this moment. The only place the
      // simulation clock advances — see the note on `persist`.
      game.lastSaved = Date.now();
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
      if (!persist()) useGame.getState().actions.reportSaveFailure();
    }, CONFIG.AUTOSAVE_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        onHide();
        return;
      }
      onShow();
    };
    // beforeunload is unreliable on iOS; pagehide is the one that actually
    // fires there. Both are cheap, and saving twice is harmless.
    const onUnload = persist;
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
