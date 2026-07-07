import * as THREE from 'three';
import type { SceneData, TierScene } from '../types';
import { C, disposeGroup, litCount, makeInstanced } from './shared';

// T7+ — the vacuum lattice: a 3×3×3 cage of resonating kernel nodes,
// energizing one by one as the impossible gets built.
const GRID = 3;
const SPACING = 1.7;

export function latticeScene(): TierScene {
  const group = new THREE.Group();

  const nodePositions: THREE.Vector3[] = [];
  for (let x = 0; x < GRID; x++)
    for (let y = 0; y < GRID; y++)
      for (let z = 0; z < GRID; z++)
        nodePositions.push(
          new THREE.Vector3((x - 1) * SPACING, (y - 1) * SPACING, (z - 1) * SPACING),
        );

  const nodes = makeInstanced(
    new THREE.IcosahedronGeometry(0.22),
    new THREE.MeshBasicMaterial(),
    nodePositions,
  );
  group.add(nodes.mesh);

  // Edges between orthogonal neighbors.
  const edgeVerts: number[] = [];
  nodePositions.forEach((a, i) => {
    nodePositions.forEach((b, j) => {
      if (j <= i) return;
      if (a.distanceTo(b) < SPACING + 0.01) edgeVerts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    });
  });
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeVerts), 3));
  const edges = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ color: C.gridLine, transparent: true, opacity: 0.6 }),
  );
  group.add(edges);

  const heart = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.34),
    new THREE.MeshBasicMaterial({ color: C.cyan }),
  );
  group.add(heart);

  let lastLit = -1;
  return {
    group,
    orbit: { radius: 8.5, height: 3, speed: 0.06, targetY: 0 },
    update(data: SceneData, t: number) {
      const lit = litCount(data.owned, nodePositions.length, 1.2);
      if (lit !== lastLit) {
        for (let i = 0; i < nodePositions.length; i++) {
          nodes.setColor(i, i < lit ? C.violet : C.raised);
        }
        lastLit = lit;
      }
      group.rotation.y = t * 0.12;
      group.rotation.x = Math.sin(t * 0.07) * 0.25;
      heart.scale.setScalar(1 + Math.sin(t * 2.2) * 0.15 + (data.surge ? 0.2 : 0));
    },
    dispose: () => disposeGroup(group),
  };
}
