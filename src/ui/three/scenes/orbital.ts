import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, addLights, disposeGroup, glow, litCount, matte } from './shared';

// T3 — near-Earth space: satellite arrays deploy along an orbital ring; the
// space-elevator beam appears once construction stage 2 is done.
const SAT_COUNT = 8;

export function orbitalScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);

  const earthMat = new THREE.MeshLambertMaterial({ color: C.raised, emissive: 0x081527 });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(6, 28, 20), earthMat);
  earth.position.y = -7.2;
  group.add(earth);

  const orbitRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.2, 0.012, 6, 64),
    new THREE.MeshBasicMaterial({ color: C.gridLine, transparent: true, opacity: 0.7 }),
  );
  orbitRing.rotation.x = Math.PI / 2.4;
  orbitRing.position.y = -0.5;
  group.add(orbitRing);

  // Satellites: body + solar wings, parked on pivots we spin in update().
  const pivots: THREE.Group[] = [];
  const sats: THREE.Mesh[] = [];
  for (let i = 0; i < SAT_COUNT; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.x = Math.PI / 2.4 - Math.PI / 2;
    const sat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), glow(C.cyan, 0.85));
    const wings = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.3), matte(C.dim));
    sat.add(wings);
    sat.position.set(4.2, 0, 0);
    pivot.add(sat);
    pivot.position.y = -0.5;
    group.add(pivot);
    pivots.push(pivot);
    sats.push(sat);
  }

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6.5, 6), glow(C.amber, 0.8));
  beam.position.y = -2.4;
  beam.visible = false;
  group.add(beam);

  const stars = starfield(group, 60, 18);

  return {
    group,
    orbit: { radius: 9.5, height: 2, speed: 0.08, targetY: -0.5 },
    update(data: SceneData, t: number) {
      const deployed = litCount(data.owned, SAT_COUNT, 1);
      pivots.forEach((p, i) => {
        p.rotation.y = t * 0.22 + (i / SAT_COUNT) * Math.PI * 2;
        sats[i].visible = i < deployed;
      });
      beam.visible = data.stagesDone >= 2;
      earth.rotation.y = t * 0.03;
      stars.rotation.y = t * 0.004;
    },
    dispose: () => disposeGroup(group),
  };
}

/** Cheap star shell shared by the space-tier scenes. */
export function starfield(group: THREE.Group, count: number, radius: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(radius);
    positions.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: C.dim, size: 0.06, sizeAttenuation: true }));
  group.add(pts);
  return pts;
}
