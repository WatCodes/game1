import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, addBackdrop, disposeGroup, glow, litCount, makeHalo, makeInstanced, matte } from './shared';

// T0 "Age of Athens" — the ruined city the cats inherited, under a night sky.
// The Temple of Zeus stands on its plinth with the old lightning still crackling
// between the columns; braziers light along the streets as you put generators to
// work, cats prowl the avenues while the grid is live, and Athena's owl circles.

// Deterministic jitter so the ruins are identical every mount — a layout that
// reshuffled on each return to tier 0 would feel like a different city.
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const MARBLE = [0x9d9585, 0x8a8273, 0xb0a695, 0x776f63];
const FLAME = 0xffb347;

export function athensScene(): TierScene {
  const group = new THREE.Group();

  // Daytime rig. The shared addLights() is a night setup built for the
  // space-age tiers; the courtyard is a bright Aegean afternoon and needs its
  // own, or the marble reads as grey slab against the parchment UI.
  const hemi = new THREE.HemisphereLight(0xdff0f7, 0xbfa878, 1.05);
  const sunKey = new THREE.DirectionalLight(0xfff0cf, 1.5);
  sunKey.position.set(5, 7, 3);
  const skyFill = new THREE.DirectionalLight(0xcfe4ea, 0.5);
  skyFill.position.set(-5, 3, -4);
  group.add(hemi, sunKey, skyFill);

  // Aegean sky washing down to warm haze, over a pale stone floor.
  addBackdrop(group, 0xcfe4ea, 0xe0cb9c, 0xd8c79c);

  const rand = rng(2718);
  const brazierSlots: THREE.Vector3[] = [];
  const flames: THREE.Mesh[] = [];

  // --- The Temple of Zeus, on its plinth ---------------------------------
  const temple = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.5, 3.4), matte(MARBLE[2]));
  plinth.position.y = 0.25;
  const steps = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.22, 4.0), matte(MARBLE[1]));
  steps.position.y = 0.11;
  temple.add(steps, plinth);

  // Colonnade around the perimeter — a few deliberately broken (it is a ruin).
  const COL_H = 2.3;
  for (let i = 0; i < 6; i++) {
    for (const z of [-1.3, 1.3]) {
      const x = -2.1 + i * 0.84;
      const broken = rand() < 0.22;
      const h = broken ? COL_H * (0.3 + rand() * 0.4) : COL_H;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, h, 10), matte(MARBLE[i % MARBLE.length]));
      col.position.set(x, 0.5 + h / 2, z);
      temple.add(col);
      if (!broken) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), matte(MARBLE[2]));
        cap.position.set(x, 0.5 + h + 0.07, z);
        temple.add(cap);
      }
    }
  }

  // Architrave + pediment roof (a triangular prism laid along X).
  const architrave = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.3, 3.2), matte(MARBLE[1]));
  architrave.position.y = 0.5 + COL_H + 0.22;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 5.0, 3), matte(MARBLE[3]));
  roof.rotation.z = Math.PI / 2;
  roof.rotation.x = Math.PI / 2;
  roof.position.y = 0.5 + COL_H + 0.95;
  temple.add(architrave, roof);
  group.add(temple);

  // The stolen spark: two crackling bolts between the columns.
  const boltMat = () =>
    new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.85, fog: false, depthWrite: false });
  const bolts = [-1.1, 1.1].map((x) => {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.01, 2.1, 5), boltMat());
    bolt.position.set(x, 0.5 + COL_H / 2, 0);
    group.add(bolt);
    return bolt;
  });
  const templeGlow = makeHalo(C.cyan, 5.5, 0.4);
  templeGlow.position.set(0, 1.7, 0);
  group.add(templeGlow);

  // --- The ruined city around it -----------------------------------------
  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      // Keep the temple precinct clear.
      if (Math.abs(gx) <= 2 && Math.abs(gz) <= 1) continue;
      if (rand() < 0.28) continue; // streets and plazas
      const x = gx * 1.7 + (rand() - 0.5) * 0.6;
      const z = gz * 1.7 + (rand() - 0.5) * 0.6;
      const w = 0.7 + rand() * 0.7;
      const d = 0.7 + rand() * 0.7;
      const h = 0.5 + rand() * rand() * 1.9;
      // Pick the stone tone at random rather than by grid position — a
      // positional formula banded the ruins into stripes of identical colour,
      // which is what made them read as one grey mass.
      const house = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        matte(MARBLE[Math.floor(rand() * MARBLE.length)], 0.7 + rand() * 0.25),
      );
      house.position.set(x, h / 2, z);
      house.rotation.y = (rand() - 0.5) * 0.7;
      group.add(house);

      // Half-standing wall stub beside the taller ruins — breaks the boxiness.
      if (h > 1.2 && rand() < 0.5) {
        const stub = new THREE.Mesh(
          new THREE.BoxGeometry(w * (0.3 + rand() * 0.3), h * (0.3 + rand() * 0.3), 0.12),
          matte(MARBLE[Math.floor(rand() * MARBLE.length)]),
        );
        stub.position.set(x + (rand() - 0.5) * 1.4, h * 0.22, z + (rand() - 0.5) * 1.4);
        stub.rotation.y = rand() * Math.PI;
        group.add(stub);
      }

      // A toppled column beside some ruins.
      if (rand() < 0.35) {
        const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1 + rand(), 8), matte(MARBLE[1]));
        fallen.rotation.z = Math.PI / 2;
        fallen.rotation.y = rand() * Math.PI;
        fallen.position.set(x + (rand() - 0.5) * 1.2, 0.13, z + (rand() - 0.5) * 1.2);
        group.add(fallen);
      }

      // Braziers on posts — these are the lights that come on with output.
      if (rand() < 0.75) {
        const bx = x + (rand() - 0.5) * 1.1;
        const bz = z + (rand() - 0.5) * 1.1;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.55, 6), matte(0x4a4238));
        post.position.set(bx, 0.27, bz);
        group.add(post);
        brazierSlots.push(new THREE.Vector3(bx, 0.62, bz));
      }
    }
  }

  // Instanced brazier flames — added BEFORE the cat streams so it stays the
  // first InstancedMesh in the group (the scene's count-driven element).
  const braziers = makeInstanced(
    new THREE.SphereGeometry(0.1, 6, 6),
    new THREE.MeshBasicMaterial({ fog: false }),
    brazierSlots,
  );
  group.add(braziers.mesh);

  // A few tall flames on the temple steps that blink independently.
  for (const x of [-2.5, 2.5]) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), glow(FLAME, 1));
    f.position.set(x, 0.75, 1.6);
    group.add(f);
    flames.push(f);
  }

  // --- Cats prowling the avenues (live only) ------------------------------
  const eyeGeo = new THREE.SphereGeometry(0.055, 6, 6);
  const catsEW = new THREE.InstancedMesh(eyeGeo, glow(0xffe9a8, 1), 22);
  const catsNS = new THREE.InstancedMesh(eyeGeo, glow(C.ok, 1), 22);
  const catOffsets = Array.from({ length: 22 }, (_, i) => i / 22 + rand() * 0.02);
  group.add(catsEW, catsNS);

  // --- Athena's owl, circling ---------------------------------------------
  const owl = new THREE.Group();
  const owlBody = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), matte(0x6b5f4e));
  owlBody.scale.set(1, 1.15, 0.85);
  const owlEyes = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), glow(C.amber, 1));
  owlEyes.position.set(0, 0.05, 0.14);
  owl.add(owlBody, owlEyes);
  owl.position.set(0, 4.2, 0);
  group.add(owl);

  // Sun over the ruins (design 2a puts it high and warm).
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 32), glow(0xfff0c4, 1));
  sun.position.set(-8, 8, -9);
  const sunGlow = makeHalo(0xf4b942, 5.4, 0.55);
  sunGlow.position.copy(sun.position);
  group.add(sun, sunGlow);

  // Smoke drifting off the temple braziers.
  const puffs = [0, 1, 2].map((i) => {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.16 + i * 0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x2e2730, transparent: true, opacity: 0, fog: false }),
    );
    group.add(p);
    return p;
  });

  let lastLit = -1;
  let lastSurge = false;
  const m = new THREE.Matrix4();

  return {
    group,
    orbit: { radius: 12, height: 5, speed: 0.06, targetY: 1.6 },
    update(data: SceneData, t: number) {
      // Braziers light as generators come online.
      const lit = litCount(data.owned, brazierSlots.length, 2);
      if (lit !== lastLit || data.surge !== lastSurge) {
        for (let i = 0; i < brazierSlots.length; i++) {
          braziers.setColor(i, i < lit ? (data.surge ? 0xfff0c0 : FLAME) : 0x140f0a);
        }
        lastLit = lit;
        lastSurge = data.surge;
      }

      // Cats pad along two avenues while the grid is live.
      const y = 0.1;
      for (let i = 0; i < catOffsets.length; i++) {
        const p = (catOffsets[i] + t * 0.05) % 1;
        m.makeScale(1, 1, 1);
        m.setPosition(-6 + p * 12, y, 3.9);
        catsEW.setMatrixAt(i, m);
        const q = (catOffsets[i] + t * 0.04 + 0.5) % 1;
        m.setPosition(5.2, y, -6 + q * 12);
        catsNS.setMatrixAt(i, m);
      }
      catsEW.instanceMatrix.needsUpdate = true;
      catsNS.instanceMatrix.needsUpdate = true;
      catsEW.visible = catsNS.visible = data.live;

      // Zeus's lightning is always there — it predates you and hums whether or
      // not you're drawing from it. That's the premise, and it keeps the very
      // first frame (nothing owned, nothing generating) from being dead.
      bolts.forEach((b, i) => {
        const mat = b.material as THREE.MeshBasicMaterial;
        if (data.live) {
          const flick = 0.35 + 0.65 * Math.abs(Math.sin(t * (7 + i * 3) + i));
          mat.opacity = data.surge ? Math.min(1, flick + 0.3) : flick;
          b.scale.y = 0.85 + Math.sin(t * 9 + i * 2) * 0.15;
        } else {
          // Dormant: a slow, faint pulse rather than a crackle.
          mat.opacity = 0.16 + 0.1 * Math.sin(t * 1.4 + i * 2);
          b.scale.y = 0.8;
        }
      });
      templeGlow.material.opacity = (data.live ? 0.35 : 0.18) + (data.surge ? 0.25 : 0);

      // Owl circles the acropolis. Children flip too, not just the group, so
      // the "goes dark when the grid is dark" contract is on real meshes.
      owl.visible = data.live;
      owlBody.visible = owlEyes.visible = data.live;
      const a = t * 0.25;
      owl.position.set(Math.cos(a) * 5.5, 4.2 + Math.sin(t * 0.5) * 0.4, Math.sin(a) * 5.5);
      owl.rotation.y = -a + Math.PI / 2;

      // The temple's flames never go out — they gutter down to embers, not to
      // black, so the precinct always has some warmth in it.
      flames.forEach((f, i) => {
        const s = 0.85 + Math.sin(t * (data.live ? 5 : 1.6) + i * 2) * 0.15;
        f.scale.setScalar(data.live ? s : s * 0.72);
        (f.material as THREE.MeshBasicMaterial).color.setHex(data.live ? FLAME : 0x8a5220);
      });

      puffs.forEach((p, i) => {
        const phase = (t * 0.3 + i / 3) % 1;
        p.position.set(2.5, 1.0 + phase * 1.7, 1.6);
        (p.material as THREE.MeshBasicMaterial).opacity = data.live ? 0.3 * (1 - phase) : 0;
      });
    },
    dispose: () => disposeGroup(group),
  };
}
