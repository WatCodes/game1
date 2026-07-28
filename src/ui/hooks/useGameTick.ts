import { useEffect } from 'react';
import { tick } from '../../engine/loop';
import { game, publishDisplay } from '../../store/gameStore';
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

    const autosave = window.setInterval(() => saveToStorage(game), CONFIG.AUTOSAVE_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') saveToStorage(game);
    };
    const onUnload = () => saveToStorage(game);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(autosave);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);
}
