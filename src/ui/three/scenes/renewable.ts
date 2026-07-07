import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, addLights, disposeGroup, glow, litCount, makeInstanced, matte } from './shared';

// T1 — rolling hills with spinning turbines and a solar field that lights up.
export function renewableScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);

  for (const [x, z, r] of [[-3, -1, 5], [4, 0, 6], [0, 2, 4.5]] as const) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), matte(C.raised));
    hill.position.set(x, -r + 0.9, z);
    hill.scale.y = 0.45;
    group.add(hill);
  }

  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), glow(C.amber, 0.9));
  sun.position.set(-6, 5, -5);
  group.add(sun);

  // Turbines: pole + hub carrying three blades; hubs spin in update().
  const hubs: THREE.Group[] = [];
  for (const [x, z, h] of [[-2.5, 0, 3.2], [0.5, -1, 3.8], [3.2, 0.5, 3]] as const) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, h, 8), matte(C.dim));
    pole.position.set(x, h / 2 + 0.6, z);
    group.add(pole);
    const hub = new THREE.Group();
    hub.position.set(x, h + 0.6, z + 0.12);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.05), matte(0xbfd0e2));
      blade.position.y = 0.75;
      const arm = new THREE.Group();
      arm.rotation.z = (b / 3) * Math.PI * 2;
      arm.add(blade);
      hub.add(arm);
    }
    group.add(hub);
    hubs.push(hub);
  }

  // Solar field: instanced tilted panels lighting cyan as they're built.
  const slots = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(-3.5 + i, 0.75, 3.2));
  const panels = makeInstanced(new THREE.BoxGeometry(0.8, 0.06, 0.6), new THREE.MeshBasicMaterial(), slots);
  panels.mesh.rotation.x = -0.5;
  panels.mesh.position.z = 0.4;
  group.add(panels.mesh);

  let lastLit = -1;
  return {
    group,
    orbit: { radius: 10, height: 4, speed: 0.07, targetY: 1.6 },
    update(data: SceneData, t: number) {
      const spin = data.live ? t * 2.2 : 0;
      hubs.forEach((h, i) => (h.rotation.z = spin + i * 1.3));
      const lit = litCount(data.owned, slots.length);
      if (lit !== lastLit) {
        for (let i = 0; i < slots.length; i++) panels.setColor(i, i < lit ? C.cyan : C.panel);
        lastLit = lit;
      }
      sun.scale.setScalar(data.surge ? 1.15 : 1);
    },
    dispose: () => disposeGroup(group),
  };
}
