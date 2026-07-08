import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, NEON, addBackdrop, addLights, disposeGroup, glow, litCount, makeHalo, matte, metal } from './shared';

// T3 — near-Earth space: the curve of a city-lit Earth below, an orbital ring
// of solar-winged satellites deploying as you build, a docking station, and
// the space-elevator beam that lights once construction is underway.
const SAT_COUNT = 10;

export function orbitalScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);
  addBackdrop(group, 0x04040d, 0x0e0a22);
  const stars = starfield(group, 110, 22);

  // Earth limb below, night side glowing with settlements.
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(6, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x123049, roughness: 0.9, metalness: 0.1, emissive: 0x030b16 }),
  );
  earth.position.y = -7.2;
  group.add(earth);
  const earthAtmo = new THREE.Mesh(
    new THREE.SphereGeometry(6.25, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x3fa0ff, transparent: true, opacity: 0.14, side: THREE.BackSide, fog: false }),
  );
  earthAtmo.position.y = -7.2;
  group.add(earthAtmo);

  const orbitRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.2, 0.012, 8, 96),
    new THREE.MeshBasicMaterial({ color: C.gridLine, transparent: true, opacity: 0.6, fog: false }),
  );
  orbitRing.rotation.x = Math.PI / 2.4;
  orbitRing.position.y = -0.5;
  group.add(orbitRing);

  // Satellites: body + glowing solar wings on spinning pivots.
  const pivots: THREE.Group[] = [];
  const sats: THREE.Object3D[] = [];
  for (let i = 0; i < SAT_COUNT; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.x = Math.PI / 2.4 - Math.PI / 2;
    const sat = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), metal(0xc9d4e6));
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.26), glow(NEON.hotCyan, 1.1));
    const wingR = wingL.clone();
    wingL.position.x = -0.45;
    wingR.position.x = 0.45;
    sat.add(body, wingL, wingR);
    sat.position.set(4.2, 0, 0);
    pivot.add(sat);
    pivot.position.y = -0.5;
    group.add(pivot);
    pivots.push(pivot);
    sats.push(sat);
  }

  // Docking station hub.
  const station = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 12), metal(0xb7c2d8));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 24), matte(0x2a3550));
  ring.rotation.x = Math.PI / 2;
  station.add(core, ring);
  station.position.set(0, 1.6, 0);
  group.add(station);

  // Space-elevator beam (appears at stage 2) + tether.
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6.8, 8), glow(C.amber, 1.4));
  beam.position.y = -2.4;
  const beamGlow = makeHalo(C.amber, 1.6, 0.5);
  beamGlow.position.set(0, 0.5, 0);
  beam.visible = beamGlow.visible = false;
  group.add(beam, beamGlow);

  return {
    group,
    orbit: { radius: 9.5, height: 2, speed: 0.08, targetY: -0.4 },
    update(data: SceneData, t: number) {
      const deployed = litCount(data.owned, SAT_COUNT, 1);
      pivots.forEach((p, i) => {
        p.rotation.y = t * 0.22 + (i / SAT_COUNT) * Math.PI * 2;
        sats[i].visible = i < deployed;
      });
      const on = data.stagesDone >= 2;
      beam.visible = beamGlow.visible = on;
      station.rotation.y = t * 0.3;
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
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaebbd8, size: 0.07, sizeAttenuation: true }));
  group.add(pts);
  return pts;
}
