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

/** Standard two-light rig shared by every scene. */
export function addLights(group: THREE.Group): void {
  const ambient = new THREE.AmbientLight(0x8899bb, 0.55);
  const key = new THREE.DirectionalLight(0xbfd8ff, 1.1);
  key.position.set(3, 5, 2);
  group.add(ambient, key);
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
