import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, addLights, disposeGroup, glow, litCount, makeInstanced, matte } from './shared';

// T0 — a low-poly city at night. Windows light with sources owned; traffic
// and smoke run while the grid is live. The 3D sibling of the SVG CityScene.
const BUILDINGS: [number, number, number, number][] = [
  // [x, z, width, height]
  [-4.2, 0.5, 1.2, 2.2], [-2.6, -0.6, 1.4, 3.4], [-1.0, 0.4, 1.0, 1.8],
  [0.4, -0.4, 1.6, 4.2], [2.0, 0.6, 1.2, 2.6], [3.4, -0.5, 1.3, 3.2],
  [4.8, 0.3, 1.0, 2.0], [-3.6, 1.8, 1.1, 1.6], [1.4, 1.9, 1.2, 2.3],
];

export function fossilScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);

  const ground = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 10), matte(C.panel));
  ground.position.y = -0.15;
  group.add(ground);

  const windowSlots: THREE.Vector3[] = [];
  for (const [x, z, w, h] of BUILDINGS) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), matte(C.raised));
    b.position.set(x, h / 2, z);
    group.add(b);
    // Window slots on the camera-facing side, two columns per floor.
    const floors = Math.max(1, Math.floor(h / 0.7));
    for (let f = 0; f < floors; f++) {
      windowSlots.push(new THREE.Vector3(x - w * 0.22, 0.5 + f * 0.7, z + w / 2 + 0.02));
      windowSlots.push(new THREE.Vector3(x + w * 0.22, 0.5 + f * 0.7, z + w / 2 + 0.02));
    }
  }
  const windows = makeInstanced(
    new THREE.BoxGeometry(0.18, 0.24, 0.04),
    new THREE.MeshBasicMaterial(),
    windowSlots,
  );
  group.add(windows.mesh);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), glow(C.dim, 0.5));
  moon.position.set(5.5, 6, -4);
  group.add(moon);

  // Traffic: two emissive slabs shuttling along the front road.
  const carA = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.28), glow(C.amber, 0.9));
  const carB = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.26), glow(C.danger, 0.8));
  carA.position.set(0, 0.12, 2.9);
  carB.position.set(0, 0.12, 3.4);
  group.add(carA, carB);

  // Smoke: three fading puffs rising from the tallest stack.
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.2, 8), matte(C.raised));
  stack.position.set(0.4, 4.7, -0.4);
  group.add(stack);
  const puffMat = new THREE.MeshBasicMaterial({ color: C.gridLine, transparent: true });
  const puffs = [0, 1, 2].map((i) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.22 + i * 0.06, 8, 8), puffMat.clone());
    group.add(p);
    return p;
  });

  let lastLit = -1;
  let lastSurge = false;

  return {
    group,
    orbit: { radius: 10.5, height: 4.5, speed: 0.07, targetY: 1.4 },
    update(data: SceneData, t: number) {
      const lit = litCount(data.owned, windowSlots.length, 2);
      if (lit !== lastLit || data.surge !== lastSurge) {
        for (let i = 0; i < windowSlots.length; i++) {
          windows.setColor(i, i < lit ? (data.surge ? 0xffe28a : C.amber) : C.panel);
        }
        lastLit = lit;
        lastSurge = data.surge;
      }
      const road = ((t * 1.6) % 16) - 8;
      carA.position.x = road;
      carB.position.x = 8 - ((t * 1.1 + 5) % 16);
      carA.visible = carB.visible = data.live;
      puffs.forEach((p, i) => {
        const phase = (t * 0.5 + i / 3) % 1;
        p.position.set(0.4, 5.3 + phase * 1.6, -0.4);
        (p.material as THREE.MeshBasicMaterial).opacity = data.live ? 0.5 * (1 - phase) : 0;
      });
    },
    dispose: () => disposeGroup(group),
  };
}
