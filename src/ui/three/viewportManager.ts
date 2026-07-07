import * as THREE from 'three';
import { sceneForTier } from './scenes';
import type { SceneData, TierScene } from './types';

// Renderer lifecycle for the 3D world viewport. Perf guardrails, learned the
// hard way from the backdrop-filter compositor lockup:
//   - 30 fps cap (an ambient diorama doesn't need 60)
//   - pixelRatio clamped, antialias off (low-poly + our palette hides it)
//   - powerPreference 'low-power' — this is a phone game
//   - hard pause when the tab is hidden or the canvas is unmounted
//   - full geometry/material/renderer disposal on teardown (HMR-safe)

const FRAME_MS = 1000 / 30;

export class ViewportManager {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private root = new THREE.Scene();
  private scene: TierScene | null = null;
  private raf: number | null = null;
  private startTime = performance.now();
  private lastFrame = 0;
  private disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private getData: () => SceneData,
    private onContextLost: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true, // app background shows through — glass chrome stays coherent
      antialias: false,
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.camera = new THREE.PerspectiveCamera(46, 2, 0.1, 100);
    this.root.fog = new THREE.Fog(0x04070e, 14, 34);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.resize();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.stop();
    this.onContextLost(); // React flips to the 2D fallback
  };

  setTier(tier: number): void {
    if (this.scene) {
      this.root.remove(this.scene.group);
      this.scene.dispose();
    }
    this.scene = sceneForTier(tier)();
    this.root.add(this.scene.group);
    this.startTime = performance.now(); // scene-local clock restarts
  }

  resize(): void {
    const { clientWidth, clientHeight } = this.canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    if (this.raf !== null || this.disposed) return;
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      if (now - this.lastFrame < FRAME_MS) return; // 30 fps gate
      this.lastFrame = now;
      if (document.hidden || !this.scene) return;
      const t = (now - this.startTime) / 1000;
      const data = this.getData();
      this.scene.update(data, t);
      const { radius, height, speed, targetY } = this.scene.orbit;
      this.camera.position.set(Math.cos(t * speed) * radius, height, Math.sin(t * speed) * radius);
      this.camera.lookAt(0, targetY, 0);
      this.renderer.render(this.root, this.camera);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  /** Render exactly one frame — used for prefers-reduced-motion. */
  renderOnce(): void {
    if (!this.scene) return;
    this.scene.update(this.getData(), 0);
    const { radius, height, targetY } = this.scene.orbit;
    this.camera.position.set(radius * 0.7, height, radius * 0.7);
    this.camera.lookAt(0, targetY, 0);
    this.renderer.render(this.root, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    if (this.scene) {
      this.root.remove(this.scene.group);
      this.scene.dispose();
      this.scene = null;
    }
    this.renderer.dispose();
    // Free the GL context immediately instead of waiting for GC — matters
    // during dev HMR where stale contexts pile up toward the browser cap.
    this.renderer.forceContextLoss();
  }
}

