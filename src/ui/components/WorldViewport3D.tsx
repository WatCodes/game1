import { useEffect, useRef } from 'react';
import { ViewportManager } from '../three/viewportManager';
import type { SceneData } from '../three/types';

// Loaded via React.lazy so three.js (~150 KB gz) stays out of the main
// chunk — 2D-only users and first paint never pay for it.
export default function WorldViewport3D({
  tier,
  data,
  onFail,
}: {
  tier: number;
  data: SceneData;
  onFail: () => void;
}) {
  // Container, not a React-owned <canvas>. The canvas is created imperatively
  // per mount so StrictMode's mount→unmount→remount can't hand a
  // context-lost canvas to a fresh WebGLRenderer (which throws). Each mount
  // gets a pristine element; unmount removes it.
  const hostRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const managerRef = useRef<ViewportManager | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'block h-40 w-full';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Your civilization, rendered live from the grid');
    host.appendChild(canvas);

    let manager: ViewportManager;
    try {
      manager = new ViewportManager(canvas, () => dataRef.current, () => failRef.current());
    } catch {
      canvas.remove();
      failRef.current(); // GL init can throw on exotic devices — fall back
      return;
    }
    managerRef.current = manager;
    manager.setTier(tier);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let interval: number | undefined;
    if (reduced) {
      manager.renderOnce();
      interval = window.setInterval(() => manager.renderOnce(), 2000);
    } else {
      manager.start();
    }

    const ro = new ResizeObserver(() => manager.resize());
    ro.observe(canvas);

    return () => {
      ro.disconnect();
      if (interval !== undefined) clearInterval(interval);
      manager.dispose();
      managerRef.current = null;
      canvas.remove();
    };
    // Mount-once: tier changes are handled by the separate effect below so we
    // don't tear down the whole GL context on every ascension.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    managerRef.current?.setTier(tier);
    managerRef.current?.renderOnce(); // instant swap even under reduced motion
  }, [tier]);

  return <div ref={hostRef} className="h-40 w-full" />;
}
