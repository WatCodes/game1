import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, NEON, addBackdrop, addLights, disposeGroup, glow, litCount, makeHalo, makeInstanced, matte, neon } from './shared';

// T0 — a Roku-City-style nightscape: a dense neon skyline in a vaporwave
// palette, with traffic light-streams, sweeping searchlights, a drifting
// blimp, blinking rooftop beacons and rising smoke. Windows light with
// sources owned; the whole city comes alive while the grid is generating.

// Deterministic jitter so the skyline is the same every mount (nicer than
// a random layout that reshuffles on each ascension back to tier 0).
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const BODY_COLORS = [0x1c1140, 0x241a4e, 0x2b1550, 0x14173a, 0x301a44];

export function fossilScene(): TierScene {
  const group = new THREE.Group();
  addLights(group);
  // Indigo sky fading to a magenta horizon — the "pop" backdrop.
  addBackdrop(group, 0x0a0824, 0x3a1145, 0x090612);

  const rand = rng(1337);
  const windowSlots: THREE.Vector3[] = [];
  const beacons: THREE.Mesh[] = [];
  const signMats: THREE.MeshBasicMaterial[] = [];
  const neonList = Object.values(NEON);

  // Buildings on a jittered grid, varied heights, some stepped.
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (rand() < 0.12) continue; // gaps = streets/plazas
      const x = gx * 1.5 + (rand() - 0.5) * 0.5;
      const z = gz * 1.5 + (rand() - 0.5) * 0.5;
      const w = 0.8 + rand() * 0.5;
      const d = 0.8 + rand() * 0.5;
      const h = 1.4 + rand() * rand() * 5.2;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        matte(BODY_COLORS[(gx + gz + 6) % BODY_COLORS.length]),
      );
      body.position.set(x, h / 2, z);
      group.add(body);

      // Optional setback crown on taller towers.
      if (h > 4 && rand() < 0.6) {
        const cw = w * 0.6;
        const ch = 0.5 + rand() * 0.8;
        const crown = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, d * 0.6), matte(BODY_COLORS[(gx + 2) % BODY_COLORS.length]));
        crown.position.set(x, h + ch / 2, z);
        group.add(crown);
      }

      // Windows on all four faces (camera fully orbits).
      const floors = Math.min(6, Math.max(1, Math.floor(h / 0.72)));
      for (let f = 0; f < floors; f++) {
        const wy = 0.5 + f * 0.72;
        if (wy > h - 0.2) break;
        windowSlots.push(new THREE.Vector3(x - w * 0.22, wy, z + d / 2 + 0.02));
        windowSlots.push(new THREE.Vector3(x + w * 0.22, wy, z + d / 2 + 0.02));
        windowSlots.push(new THREE.Vector3(x - w * 0.22, wy, z - d / 2 - 0.02));
        windowSlots.push(new THREE.Vector3(x + w * 0.22, wy, z - d / 2 - 0.02));
        windowSlots.push(new THREE.Vector3(x + w / 2 + 0.02, wy, z));
        windowSlots.push(new THREE.Vector3(x - w / 2 - 0.02, wy, z));
      }

      // Rooftop beacon on tall towers — blinks in update.
      if (h > 4.2) {
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), glow(C.danger, 1));
        beacon.position.set(x, h + 0.15, z);
        group.add(beacon);
        beacons.push(beacon);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), matte(C.dim));
        mast.position.set(x, h + 0.15, z);
        group.add(mast);
      }

      // Neon sign on some mid-rise faces.
      if (h > 2 && rand() < 0.5) {
        const color = neonList[Math.floor(rand() * neonList.length)];
        const mat = neon(color);
        const sh = 0.5 + rand() * 0.7;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, sh), mat);
        const sy = 1 + rand() * (h - 1.5);
        sign.position.set(x, sy, z + d / 2 + 0.03);
        group.add(sign);
        signMats.push(mat);
        // Glow halo behind the sign so it reads as lit neon, not a flat decal.
        const halo = makeHalo(color, Math.max(w, sh) * 2.4, 0.75);
        halo.position.set(x, sy, z + d / 2 + 0.05);
        group.add(halo);
      }
    }
  }

  const windows = makeInstanced(
    new THREE.BoxGeometry(0.16, 0.22, 0.03),
    new THREE.MeshBasicMaterial({ fog: false }),
    windowSlots,
  );
  group.add(windows.mesh);

  // Traffic: two instanced light-streams along cross streets.
  const streamGeo = new THREE.SphereGeometry(0.07, 6, 6);
  const headlights = new THREE.InstancedMesh(streamGeo, glow(0xfff2cf, 1), 26);
  const taillights = new THREE.InstancedMesh(streamGeo, glow(C.danger, 1), 26);
  const carOffsets = Array.from({ length: 26 }, (_, i) => i / 26 + Math.random() * 0.02);
  group.add(headlights, taillights);

  // Searchlights: translucent cones sweeping from two rooftops.
  const beamMat = new THREE.MeshBasicMaterial({ color: NEON.hotCyan, transparent: true, opacity: 0.14, fog: false, side: THREE.DoubleSide, depthWrite: false });
  const searchlights = [
    { x: -3, z: 1, base: 4 },
    { x: 3.2, z: -1.5, base: 3.4 },
  ].map((s) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6, 16, 1, true), beamMat.clone());
    cone.position.set(s.x, s.base + 3, s.z);
    group.add(cone);
    return cone;
  });

  // Drifting blimp with a running light.
  const blimp = new THREE.Group();
  const envelope = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), matte(0x3a2a5a));
  envelope.scale.set(1.7, 0.7, 0.7);
  const runLight = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), glow(NEON.hotCyan, 1));
  runLight.position.set(-0.85, 0, 0);
  blimp.add(envelope, runLight);
  blimp.position.set(0, 6.5, 0);
  group.add(blimp);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 32), glow(0xdcd6ff, 0.85));
  moon.position.set(-7, 8, -8);
  const moonGlow = makeHalo(0xcfd0ff, 4.2, 0.5);
  moonGlow.position.copy(moon.position);
  group.add(moon, moonGlow);

  // Smoke puffs from the tallest stack.
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1, 8), matte(C.raised));
  stack.position.set(-1.5, 5.2, 2.4);
  group.add(stack);
  const puffs = [0, 1, 2].map((i) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.2 + i * 0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0x3a3550, transparent: true, opacity: 0, fog: false }));
    group.add(p);
    return p;
  });

  let lastLit = -1;
  let lastSurge = false;
  const m = new THREE.Matrix4();

  return {
    group,
    orbit: { radius: 11, height: 5, speed: 0.06, targetY: 2 },
    update(data: SceneData, t: number) {
      const lit = litCount(data.owned, windowSlots.length, 2);
      if (lit !== lastLit || data.surge !== lastSurge) {
        for (let i = 0; i < windowSlots.length; i++) {
          windows.setColor(i, i < lit ? (data.surge ? 0xffe9a8 : C.amber) : 0x0d0a1c);
        }
        lastLit = lit;
        lastSurge = data.surge;
      }

      // Traffic streams (only while the grid is live).
      const roadY = 0.12;
      for (let i = 0; i < carOffsets.length; i++) {
        const p = (carOffsets[i] + t * 0.06) % 1;
        m.makeScale(1, 1, 1);
        m.setPosition(-5 + p * 10, roadY, 3.4);
        headlights.setMatrixAt(i, m);
        const q = (carOffsets[i] + t * 0.05 + 0.5) % 1;
        m.setPosition(4.6, roadY, -5 + q * 10);
        taillights.setMatrixAt(i, m);
      }
      headlights.instanceMatrix.needsUpdate = true;
      taillights.instanceMatrix.needsUpdate = true;
      headlights.visible = taillights.visible = data.live;

      // Searchlights sweep; blimp drifts; beacons blink; smoke rises — live only.
      searchlights.forEach((c, i) => {
        c.visible = data.live;
        c.rotation.z = Math.sin(t * 0.4 + i * 2) * 0.6;
        c.rotation.x = Math.PI + Math.cos(t * 0.3 + i) * 0.25;
      });
      blimp.visible = data.live;
      blimp.position.x = ((t * 0.35 + 8) % 16) - 8;
      blimp.position.z = -3 + Math.sin(t * 0.1) * 1.5;
      (runLight.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 4) > 0 ? NEON.hotCyan : 0x0a2a30);

      const blink = Math.sin(t * 3) > 0;
      beacons.forEach((b) => ((b.material as THREE.MeshBasicMaterial).color.setHex(blink ? C.danger : 0x300808)));

      // Neon signs shimmer; brighter during a surge.
      signMats.forEach((mat, i) => {
        const flick = 0.7 + 0.3 * Math.sin(t * (1.5 + i * 0.3) + i) + (data.surge ? 0.2 : 0);
        mat.opacity = Math.min(1, flick);
        mat.transparent = true;
      });

      puffs.forEach((p, i) => {
        const phase = (t * 0.4 + i / 3) % 1;
        p.position.set(-1.5, 5.7 + phase * 1.8, 2.4);
        (p.material as THREE.MeshBasicMaterial).opacity = data.live ? 0.4 * (1 - phase) : 0;
      });
    },
    dispose: () => disposeGroup(group),
  };
}
