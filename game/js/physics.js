// physics.js — gravity flight for a delivery pod. Pure and DOM-free so the same
// code steers the live pod, the aim preview and the unit tests. Integration is
// semi-implicit Euler at a fixed step, which keeps flight stable and repeatable.

// Softening length (px): keeps acceleration finite as a pod nears a centre.
const SOFTENING_PX = 12;

// Total gravitational acceleration at a point from every planet's pull.
// Each planet carries mu, its gravitational parameter (px^3 / s^2).
export function gravityAt(x, y, planets) {
  let ax = 0;
  let ay = 0;
  for (const planet of planets) {
    const dx = planet.x - x;
    const dy = planet.y - y;
    const distSq = dx * dx + dy * dy + SOFTENING_PX * SOFTENING_PX;
    const scale = planet.mu / (distSq * Math.sqrt(distSq));
    ax += dx * scale;
    ay += dy * scale;
  }
  return { ax, ay };
}

// Advance one pod {x, y, vx, vy} by dt seconds under the planets' gravity.
export function stepPod(pod, planets, dt) {
  const { ax, ay } = gravityAt(pod.x, pod.y, planets);
  pod.vx += ax * dt;
  pod.vy += ay * dt;
  pod.x += pod.vx * dt;
  pod.y += pod.vy * dt;
  return pod;
}

// Fly a copy of a pod and record its path: the start point, then one point every
// sampleEvery steps. Returns fresh {x, y} points; the input pod is untouched.
export function simulateFlight(start, planets, { seconds, step, sampleEvery }) {
  const pod = { x: start.x, y: start.y, vx: start.vx, vy: start.vy };
  const points = [{ x: pod.x, y: pod.y }];
  const totalSteps = Math.round(seconds / step);
  for (let i = 1; i <= totalSteps; i += 1) {
    stepPod(pod, planets, step);
    if (i % sampleEvery === 0 && i < totalSteps) points.push({ x: pod.x, y: pod.y });
  }
  return points;
}
