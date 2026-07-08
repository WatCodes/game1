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
//
// Camera is orbit-controlled: it drifts on its own, but a finger drag takes
// over (azimuth + elevation), pinch zooms, and auto-orbit resumes after a
// short idle. State is spherical (theta, phi, distance) around a target.

const FRAME_MS = 1000 / 30;
const IDLE_RESUME_MS = 2600; // auto-orbit resumes this long after last touch
const DRAG_SPEED = 0.006; // rad per px
const MIN_PHI = 0.06;
const MAX_PHI = 1.4;

export class ViewportManager {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private root = new THREE.Scene();
  private scene: TierScene | null = null;
  private raf: number | null = null;
  private startTime = performance.now();
  private lastFrame = 0;
  private prevTime = performance.now();
  private disposed = false;

  // Orbit camera state
  private theta = Math.PI * 0.25;
  private phi = 0.5;
  private distance = 10;
  private targetY = 0;
  private autoSpeed = 0.07;
  private baseDistance = 10;
  private lastInteract = 0; // 0 → auto-orbit from the start
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private getData: () => SceneData,
    private onContextLost: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true, // app background shows through — glass chrome stays coherent
      antialias: true, // MSAA on the canvas — the single biggest "not-Roblox" win
      powerPreference: 'low-power',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Filmic tone mapping: soft highlight rolloff instead of flat clipped color.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.camera = new THREE.PerspectiveCamera(46, 2, 0.1, 100);
    // Deep-indigo fog, pushed back so it separates the scene from the near-black
    // page without swallowing it.
    this.root.fog = new THREE.Fog(0x0b0a1e, 22, 46);
    canvas.style.touchAction = 'none'; // we own the gesture; no page scroll/zoom
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.resize();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.stop();
    this.onContextLost(); // React flips to the 2D fallback
  };

  // ---- gesture handling -----------------------------------------------------
  private onPointerDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.lastInteract = performance.now();
    if (this.pointers.size === 2) this.pinchDist = this.currentPinch();
  };

  private onPointerMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    prev.x = e.clientX;
    prev.y = e.clientY;
    this.lastInteract = performance.now();

    if (this.pointers.size >= 2) {
      const d = this.currentPinch();
      if (this.pinchDist > 0 && d > 0) {
        this.distance *= this.pinchDist / d; // fingers apart → closer
        this.clampDistance();
      }
      this.pinchDist = d;
      return;
    }
    this.theta -= dx * DRAG_SPEED;
    this.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, this.phi - dy * DRAG_SPEED));
  };

  private onPointerUp = (e: PointerEvent) => {
    this.canvas.releasePointerCapture?.(e.pointerId);
    this.pointers.delete(e.pointerId);
    this.lastInteract = performance.now();
    if (this.pointers.size < 2) this.pinchDist = 0;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.distance *= e.deltaY > 0 ? 1.08 : 1 / 1.08;
    this.clampDistance();
    this.lastInteract = performance.now();
  };

  private currentPinch(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  private clampDistance(): void {
    this.distance = Math.max(this.baseDistance * 0.45, Math.min(this.baseDistance * 1.9, this.distance));
  }

  // ---- scene / lifecycle ----------------------------------------------------
  setTier(tier: number): void {
    if (this.scene) {
      this.root.remove(this.scene.group);
      this.scene.dispose();
    }
    this.scene = sceneForTier(tier)();
    this.root.add(this.scene.group);
    this.startTime = performance.now(); // scene-local clock restarts
    const { radius, height, speed, targetY } = this.scene.orbit;
    this.baseDistance = Math.hypot(radius, height);
    this.distance = this.baseDistance;
    this.phi = Math.atan2(height, radius);
    this.autoSpeed = speed;
    this.targetY = targetY;
  }

  private render(): void {
    this.renderer.render(this.root, this.camera);
  }

  resize(): void {
    const { clientWidth, clientHeight } = this.canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
  }

  private placeCamera(): void {
    const cp = Math.cos(this.phi);
    this.camera.position.set(
      Math.cos(this.theta) * cp * this.distance,
      Math.sin(this.phi) * this.distance,
      Math.sin(this.theta) * cp * this.distance,
    );
    this.camera.lookAt(0, this.targetY, 0);
  }

  start(): void {
    if (this.raf !== null || this.disposed) return;
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      if (now - this.lastFrame < FRAME_MS) return; // 30 fps gate
      const dt = Math.min(0.1, (now - this.prevTime) / 1000);
      this.prevTime = now;
      this.lastFrame = now;
      if (document.hidden || !this.scene) return;
      const t = (now - this.startTime) / 1000;
      this.scene.update(this.getData(), t);
      // Auto-orbit only when the player isn't actively driving.
      if (this.pointers.size === 0 && now - this.lastInteract > IDLE_RESUME_MS) {
        this.theta += this.autoSpeed * dt;
      }
      this.placeCamera();
      this.render();
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
    this.placeCamera();
    this.render();
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
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
