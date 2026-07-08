import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, NEON, addBackdrop, addLights, disposeGroup, litCount, makeHalo, metal } from './shared';
import { starfield } from './orbital';

// T5 — the black hole. The accretion twist drives the scene: feed rate spins
// and brightens the disk, heat shifts it amber→white toward a flare. A photon
// ring, twin relativistic jets and orbiting Penrose collectors complete it.
export function exoticScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);
  addBackdrop(group, 0x05030c, 0x120a1e);
  const stars = starfield(group, 110, 19);

  // Accretion disk FIRST (tests read the first torus as the disk).
  const diskMat = new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0.75, fog: false, side: THREE.DoubleSide });
  const disk = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.42, 12, 96), diskMat);
  disk.rotation.x = Math.PI / 2 - 0.25;
  disk.scale.z = 0.22;
  group.add(disk);

  const horizon = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(1.14, 32, 24),
    new THREE.MeshBasicMaterial({ color: C.violet, transparent: true, opacity: 0.4, side: THREE.BackSide, fog: false }),
  );
  // Photon ring — a thin bright halo around the shadow.
  const photon = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.02, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0xffe6b0, fog: false }),
  );
  photon.rotation.x = Math.PI / 2 - 0.25;
  group.add(horizon, rim, photon);

  // Twin jets with glow halos.
  const jetMat = new THREE.MeshBasicMaterial({ color: NEON.hotCyan, transparent: true, opacity: 0.7, fog: false });
  const jetUp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.16, 5, 10), jetMat);
  jetUp.position.y = 3.3;
  const jetDown = jetUp.clone();
  jetDown.rotation.x = Math.PI;
  jetDown.position.y = -3.3;
  const jetGlowU = makeHalo(NEON.hotCyan, 1.6, 0.5);
  jetGlowU.position.y = 5.4;
  const jetGlowD = makeHalo(NEON.hotCyan, 1.6, 0.5);
  jetGlowD.position.y = -5.4;
  group.add(jetUp, jetDown, jetGlowU, jetGlowD);

  const collectors: THREE.Mesh[] = [];
  const collectorPivot = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), metal(0xcfe0f2));
    const a = (i / 6) * Math.PI * 2;
    c.position.set(Math.cos(a) * 3.4, Math.sin(a * 2) * 0.4, Math.sin(a) * 3.4);
    collectorPivot.add(c);
    collectors.push(c);
  }
  group.add(collectorPivot);

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
      jetUp.visible = jetDown.visible = jetGlowU.visible = jetGlowD.visible = jetsOn;
      jetMat.opacity = jetsOn ? 0.4 + data.feedRate * 0.5 : 0;
      photon.rotation.z = t * 0.4;
      const deployed = litCount(data.owned, collectors.length, 0.8);
      collectors.forEach((c, i) => (c.visible = i < deployed));
      collectorPivot.rotation.y = t * 0.3;
      rim.scale.setScalar(data.surge ? 1.06 : 1);
      stars.rotation.y = t * 0.004;
    },
    dispose: () => disposeGroup(group),
  };
}
