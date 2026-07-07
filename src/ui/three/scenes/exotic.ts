import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, addLights, disposeGroup, glow, litCount } from './shared';
import { starfield } from './orbital';

// T5 — the black hole. The accretion twist drives the scene directly: feed
// rate spins and brightens the disk, heat shifts it amber → white toward the
// flare. The tier's own mechanic IS the animation.
export function exoticScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);

  const horizon = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 18), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(1.12, 24, 18),
    new THREE.MeshBasicMaterial({ color: C.violet, transparent: true, opacity: 0.35, side: THREE.BackSide }),
  );
  group.add(horizon, rim);

  const diskMat = new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0.75 });
  const disk = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.42, 10, 80), diskMat);
  disk.rotation.x = Math.PI / 2 - 0.25;
  disk.scale.z = 0.22; // squash the tube into a thin luminous plane
  group.add(disk);

  const jetMat = new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.7 });
  const jetUp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 4.5, 8), jetMat);
  jetUp.position.y = 3.1;
  const jetDown = jetUp.clone();
  jetDown.rotation.x = Math.PI;
  jetDown.position.y = -3.1;
  group.add(jetUp, jetDown);

  // Penrose collectors riding the ergosphere.
  const collectors: THREE.Mesh[] = [];
  const collectorPivot = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), glow(C.cyan, 0.9));
    const a = (i / 5) * Math.PI * 2;
    c.position.set(Math.cos(a) * 3.4, Math.sin(a * 2) * 0.4, Math.sin(a) * 3.4);
    collectorPivot.add(c);
    collectors.push(c);
  }
  group.add(collectorPivot);

  const stars = starfield(group, 80, 17);
  const hot = new THREE.Color(0xfff3d6);
  const base = new THREE.Color(C.amber);

  return {
    group,
    orbit: { radius: 9, height: 2.8, speed: 0.055, targetY: 0 },
    update(data: SceneData, t: number) {
      disk.rotation.z = t * (0.25 + data.feedRate * 2.2);
      diskMat.opacity = 0.55 + data.feedRate * 0.4;
      diskMat.color.copy(base).lerp(hot, data.heat);
      const jetsOn = data.live;
      jetUp.visible = jetDown.visible = jetsOn;
      jetMat.opacity = jetsOn ? 0.4 + data.feedRate * 0.5 : 0;
      const deployed = litCount(data.owned, collectors.length, 0.8);
      collectors.forEach((c, i) => (c.visible = i < deployed));
      collectorPivot.rotation.y = t * 0.3;
      rim.scale.setScalar(data.surge ? 1.06 : 1);
      stars.rotation.y = t * 0.004;
    },
    dispose: () => disposeGroup(group),
  };
}
