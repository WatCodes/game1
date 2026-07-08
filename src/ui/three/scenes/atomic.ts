import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, NEON, addBackdrop, addLights, disposeGroup, glow, litCount, makeHalo, makeInstanced, matte } from './shared';
import { starfield } from './orbital';

// T2 — the home planet from orbit: an atmosphere-rimmed globe whose night side
// lights up with city clusters as the grid spreads, wrapped by a planetary
// power ring, a patrolling moon and a fusion-glow at the poles.
const CITY_LATLON: [number, number][] = [
  [15, 0], [35, 50], [-10, 90], [25, 140], [-30, 190], [5, 230], [45, 270], [-20, 310],
  [60, 40], [-45, 120], [10, 170], [30, 320], [-15, 20], [40, 100], [-35, 260], [20, 70],
];

function onSphere(latDeg: number, lonDeg: number, r: number): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon));
}

export function atomicScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);
  addBackdrop(group, 0x05050f, 0x140a28); // deep space, faint violet horizon
  const stars = starfield(group, 90, 20);

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x16304e, roughness: 0.9, metalness: 0.1, emissive: 0x030a16 }),
  );
  group.add(planet);

  // Atmosphere rim glow (BackSide shell).
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(2.62, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x3fa0ff, transparent: true, opacity: 0.16, side: THREE.BackSide, fog: false }),
  );
  group.add(atmo);

  // Planetary power ring — the "ring main".
  const ringMat = new THREE.MeshBasicMaterial({ color: NEON.hotCyan, transparent: true, opacity: 0.45, fog: false });
  const eq = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.02, 8, 96), ringMat);
  eq.rotation.x = Math.PI / 2 - 0.35;
  group.add(eq);

  // City lights ride the surface; each carries a soft halo.
  const cities = makeInstanced(new THREE.SphereGeometry(0.07, 8, 8), glow(C.amber, 1.4), CITY_LATLON.map(([la, lo]) => onSphere(la, lo, 2.44)));
  const cityGroup = new THREE.Group();
  cityGroup.add(cities.mesh);
  const haloRefs: THREE.Sprite[] = CITY_LATLON.map(([la, lo]) => {
    const h = makeHalo(C.amber, 0.5, 0.7);
    h.position.copy(onSphere(la, lo, 2.46));
    cityGroup.add(h);
    return h;
  });
  group.add(cityGroup);

  const moonPivot = new THREE.Group();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 20), matte(0x8a8fb0, 0.9));
  moon.position.set(4.6, 0.8, 0);
  moonPivot.add(moon);
  group.add(moonPivot);

  let lastLit = -1;
  return {
    group,
    orbit: { radius: 8.5, height: 2.6, speed: 0.085, targetY: 0 },
    update(data: SceneData, t: number) {
      const lit = Math.min(CITY_LATLON.length, data.milestones + litCount(data.owned, 8, 0.8));
      if (lit !== lastLit) {
        for (let i = 0; i < CITY_LATLON.length; i++) {
          cities.setColor(i, i < lit ? (data.surge ? 0xffe9a8 : C.amber) : 0x1a1508);
          haloRefs[i].visible = i < lit;
        }
        lastLit = lit;
      }
      planet.rotation.y = t * 0.06;
      cityGroup.rotation.y = t * 0.06;
      moonPivot.rotation.y = t * 0.25;
      ringMat.opacity = data.surge ? 0.8 : 0.45;
      stars.rotation.y = t * 0.004;
    },
    dispose: () => disposeGroup(group),
  };
}
