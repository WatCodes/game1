import * as THREE from 'three';

// Theme tokens as hex — three.js can't read CSS custom properties.
export const C = {
  bg: 0x04070e,
  panel: 0x0a101c,
  raised: 0x111a2c,
  gridLine: 0x1a2842,
  cyan: 0x22d3ee,
  cyanDim: 0x0e7490,
  amber: 0xfbbf24,
  amberDim: 0x92610a,
  violet: 0xa78bfa,
  dim: 0x64748b,
  ok: 0x34d399,
  danger: 0xf87171,
} as const;

// Vaporwave neon palette — bright, saturated signs that pop against the dark
// buildings without needing a bloom pass (too costly on the mobile budget).
export const NEON = {
  pink: 0xff2d95,
  hotCyan: 0x00e5ff,
  magenta: 0xd946ef,
  amber: 0xffb300,
  lime: 0x39ff88,
  blue: 0x3b6bff,
} as const;

/** Sub-linear ramp so early buys visibly change the world (mirrors 2D). */
export function litCount(owned: number, max: number, k = 1.6): number {
  return Math.min(max, Math.ceil(Math.sqrt(Math.max(0, owned)) * k));
}

/** Matte surface that still reads in our dark, low-light scenes. */
export function matte(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

/** Self-lit material — the workhorse for windows, stars, power lines. */
export function glow(color: number, intensity = 1): THREE.MeshBasicMaterial {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c });
}

/**
 * Three-light rig shared by every scene. The violet rim light is the key to
 * "pop" — it edge-lights silhouettes so objects separate from the near-black
 * app background instead of blending into it.
 */
export function addLights(group: THREE.Group): void {
  const hemi = new THREE.HemisphereLight(0x9bb0ff, 0x140a2e, 0.75);
  const key = new THREE.DirectionalLight(0xe2ecff, 1.25);
  key.position.set(4, 6, 3);
  const rim = new THREE.DirectionalLight(0xc084fc, 0.7);
  rim.position.set(-5, 2, -5);
  group.add(hemi, key, rim);
}

/**
 * Gradient sky dome (+ optional ground disk) so scenes read against a lit
 * backdrop rather than the flat page color. BackSide sphere, vertex-colored
 * top→horizon, fog-immune and depth-write-off so it always sits behind.
 */
export function addBackdrop(
  group: THREE.Group,
  topHex: number,
  horizonHex: number,
  groundHex?: number,
): void {
  const R = 42;
  const geo = new THREE.SphereGeometry(R, 24, 16);
  const top = new THREE.Color(topHex);
  const hor = new THREE.Color(horizonHex);
  const colors: number[] = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / R; // −1 (bottom) .. 1 (top)
    const tt = Math.pow(Math.max(0, Math.min(1, (y + 0.15) / 1.15)), 0.85);
    const c = hor.clone().lerp(top, tt);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  dome.renderOrder = -1;
  group.add(dome);

  if (groundHex !== undefined) {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(32, 48), new THREE.MeshBasicMaterial({ color: groundHex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    group.add(ground);
  }
}

/** Recursively free geometries and materials — WebGL memory is manual. */
export function disposeGroup(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}

/**
 * Instanced mesh with per-instance color — the pattern for anything
 * count-driven (windows, city lights, satellites). Returns a helper to
 * recolor instance i without touching the transform.
 */
export function makeInstanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  positions: THREE.Vector3[],
  scale = 1,
): { mesh: THREE.InstancedMesh; setColor: (i: number, color: number) => void } {
  const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
  const m = new THREE.Matrix4();
  positions.forEach((p, i) => {
    m.makeScale(scale, scale, scale);
    m.setPosition(p);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, new THREE.Color(C.raised));
  });
  mesh.instanceMatrix.needsUpdate = true;
  const setColor = (i: number, color: number) => {
    mesh.setColorAt(i, new THREE.Color(color));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  return { mesh, setColor };
}
