// Deliberately three-free: WorldViewport imports this synchronously to decide
// 2D vs 3D, and anything that imports three.js here would drag the whole
// library into the main bundle and defeat the lazy split.

let cached = false;

/**
 * Capability probe; false → the SVG diorama takes over. Only SUCCESS is
 * cached: Chromium can transiently refuse WebGL contexts while a window is
 * hidden or the GPU process is warming up, and caching that moment would
 * lock a capable device out of 3D for the whole session.
 */
export function webglAvailable(): boolean {
  if (cached) return true;
  try {
    const canvas = document.createElement('canvas');
    cached = !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    cached = false;
  }
  return cached;
}
