import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { NEON, addBackdrop, addLights, disposeGroup, glow, litCount, makeHalo, makeInstanced, matte, metal } from './shared';

// T1 — a twilight renewable valley: rolling hills, a spinning wind farm, a
// glowing solar field, a control hub with lit windows, and power lines that
// carry a visible current. Aurora-tinted sky.
export function renewableScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);
  addBackdrop(group, 0x081226, 0x123b3a, 0x060f14); // deep teal twilight

  // Layered hills.
  for (const [x, z, r, c] of [
    [-3, -1, 5, 0x0e2230],
    [4, 0, 6, 0x0c1c2c],
    [0, 2.5, 4.5, 0x102a34],
  ] as const) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), matte(c));
    hill.position.set(x, -r + 0.9, z);
    hill.scale.y = 0.45;
    group.add(hill);
  }

  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 24), glow(0xff8a4c, 0.9));
  sun.position.set(-6.5, 3.6, -6);
  const sunGlow = makeHalo(0xff7a3c, 5, 0.55);
  sunGlow.position.copy(sun.position);
  group.add(sun, sunGlow);

  // Wind farm: poles + spinning three-blade hubs.
  const hubs: THREE.Group[] = [];
  for (const [x, z, h] of [
    [-2.6, 0, 3.2],
    [0.4, -1, 3.9],
    [3.1, 0.6, 3],
    [-4, 1.2, 2.6],
    [1.8, 1.8, 3.4],
  ] as const) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, h, 10), metal(0xdfe6f2));
    pole.position.set(x, h / 2 + 0.6, z);
    group.add(pole);
    const hub = new THREE.Group();
    hub.position.set(x, h + 0.6, z + 0.1);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.04), matte(0xf0f4ff, 0.5));
      blade.position.y = 0.8;
      const arm = new THREE.Group();
      arm.rotation.z = (b / 3) * Math.PI * 2;
      arm.add(blade);
      hub.add(arm);
    }
    group.add(hub);
    hubs.push(hub);
  }

  // Solar field: instanced tilted panels lighting cyan as built.
  const slots = Array.from({ length: 12 }, (_, i) =>
    new THREE.Vector3(-3.8 + (i % 6) * 1.15, 0.7, 3.0 + Math.floor(i / 6) * 1.0),
  );
  const panels = makeInstanced(new THREE.BoxGeometry(0.85, 0.05, 0.62), matte(0x0b1830, 0.4), slots);
  panels.mesh.rotation.x = -0.5;
  group.add(panels.mesh);

  // Control hub with lit windows.
  const hub = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.0), matte(0x14203a));
  hub.position.set(4.2, 0.45, 2.4);
  group.add(hub);
  const hubWinSlots = [-0.4, 0, 0.4].map((dx) => new THREE.Vector3(4.2 + dx, 0.5, 2.92));
  const hubWins = makeInstanced(new THREE.BoxGeometry(0.18, 0.24, 0.03), glow(NEON.hotCyan, 1.2), hubWinSlots);
  group.add(hubWins.mesh);

  // Power line with a flowing current (dashed emissive not available cheaply;
  // use a few travelling glow beads instead).
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 6), glow(NEON.hotCyan, 1.4), 8);
  group.add(beads);
  const lineA = new THREE.Vector3(4.2, 1.0, 2.4);
  const lineB = new THREE.Vector3(-2.6, 1.4, 0);

  const stars = starDots(group, 40, 15);
  let lastLit = -1;
  const m = new THREE.Matrix4();

  return {
    group,
    orbit: { radius: 10.5, height: 4.2, speed: 0.065, targetY: 1.6 },
    update(data: SceneData, t: number) {
      const spin = data.live ? t * 2.2 : 0;
      hubs.forEach((h, i) => (h.rotation.z = spin + i * 1.3));
      const lit = litCount(data.owned, slots.length);
      if (lit !== lastLit) {
        for (let i = 0; i < slots.length; i++) panels.setColor(i, i < lit ? NEON.hotCyan : 0x0b1830);
        lastLit = lit;
      }
      sun.scale.setScalar(data.surge ? 1.12 : 1);
      // Current beads travel the line while live.
      for (let i = 0; i < 8; i++) {
        const p = data.live ? (i / 8 + t * 0.3) % 1 : -1;
        m.makeScale(1, 1, 1);
        m.setPosition(lineA.clone().lerp(lineB, Math.max(0, p)));
        beads.setMatrixAt(i, m);
      }
      beads.instanceMatrix.needsUpdate = true;
      beads.visible = data.live;
      stars.rotation.y = t * 0.003;
    },
    dispose: () => disposeGroup(group),
  };
}

/** Small star-dot shell for the twilight/ground scenes. */
function starDots(group: THREE.Group, count: number, radius: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(radius);
    if (v.y < 0) v.y = -v.y; // upper hemisphere
    positions.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fb4d6, size: 0.05, sizeAttenuation: true }));
  group.add(pts);
  return pts;
}
