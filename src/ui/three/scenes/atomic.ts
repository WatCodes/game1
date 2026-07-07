import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, addLights, disposeGroup, glow, litCount, makeInstanced } from './shared';

// T2 — the whole planet: city lights spread with progress, moon on patrol.
const CITY_LATLON: [number, number][] = [
  [15, 0], [35, 50], [-10, 90], [25, 140], [-30, 190], [5, 230], [45, 270], [-20, 310], [60, 40], [-45, 120],
  [10, 170], [30, 320],
];

function onSphere(latDeg: number, lonDeg: number, r: number): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.sin(lat),
    r * Math.cos(lat) * Math.sin(lon),
  );
}

export function atomicScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);

  const planetMat = new THREE.MeshLambertMaterial({ color: C.raised, emissive: 0x0a1a2e });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 18), planetMat);
  group.add(planet);

  // Grid meridians — the "planetary ring main" reading as infrastructure.
  const ringMat = new THREE.MeshBasicMaterial({ color: C.cyanDim, transparent: true, opacity: 0.5 });
  const eq = new THREE.Mesh(new THREE.TorusGeometry(2.46, 0.015, 6, 48), ringMat);
  eq.rotation.x = Math.PI / 2;
  const mer = new THREE.Mesh(new THREE.TorusGeometry(2.46, 0.015, 6, 48), ringMat.clone());
  group.add(eq, mer);

  const cities = makeInstanced(
    new THREE.SphereGeometry(0.08, 6, 6),
    new THREE.MeshBasicMaterial(),
    CITY_LATLON.map(([la, lo]) => onSphere(la, lo, 2.44)),
  );
  group.add(cities.mesh);

  const moonPivot = new THREE.Group();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), glow(C.dim, 0.45));
  moon.position.set(4.4, 0.8, 0);
  moonPivot.add(moon);
  group.add(moonPivot);

  let lastLit = -1;
  return {
    group,
    orbit: { radius: 8, height: 2.5, speed: 0.09, targetY: 0 },
    update(data: SceneData, t: number) {
      const lit = Math.min(CITY_LATLON.length, data.milestones + litCount(data.owned, 6, 0.8));
      if (lit !== lastLit) {
        for (let i = 0; i < CITY_LATLON.length; i++) cities.setColor(i, i < lit ? C.amber : C.panel);
        lastLit = lit;
      }
      planet.rotation.y = t * 0.06;
      cities.mesh.rotation.y = t * 0.06; // lights ride the surface
      moonPivot.rotation.y = t * 0.25;
      (eq.material as THREE.MeshBasicMaterial).opacity = data.surge ? 0.9 : 0.5;
    },
    dispose: () => disposeGroup(group),
  };
}
