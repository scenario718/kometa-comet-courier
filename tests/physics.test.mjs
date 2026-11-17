// Unit tests for KOMETA's gravity physics: acceleration, stepping, flight paths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gravityAt, stepPod, simulateFlight } from '../game/js/physics.js';

const planet = { x: 400, y: 400, radius: 30, mu: 90000 };

test('gravityAt pulls a pod toward the planet centre', () => {
  const pull = gravityAt(400, 300, [planet]); // pod directly above the planet
  assert.ok(Math.abs(pull.ax) < 1e-9, 'no sideways pull on the axis');
  assert.ok(pull.ay > 0, 'pull points down toward the planet');
});

test('gravityAt weakens with distance (inverse square)', () => {
  const near = gravityAt(400, 320, [planet]);
  const far = gravityAt(400, 200, [planet]);
  assert.ok(Math.hypot(near.ax, near.ay) > Math.hypot(far.ax, far.ay) * 3);
});

test('a pod with no planets keeps a constant velocity', () => {
  const pod = { x: 10, y: 10, vx: 50, vy: -20 };
  stepPod(pod, [], 0.5);
  assert.equal(pod.vx, 50);
  assert.equal(pod.vy, -20);
  assert.equal(pod.x, 35);
  assert.equal(pod.y, 0);
});

test('a resting pod falls toward the planet over time', () => {
  const pod = { x: 400, y: 250, vx: 0, vy: 0 };
  const startDistance = Math.hypot(pod.x - planet.x, pod.y - planet.y);
  for (let i = 0; i < 60; i += 1) stepPod(pod, [planet], 1 / 60);
  const endDistance = Math.hypot(pod.x - planet.x, pod.y - planet.y);
  assert.ok(endDistance < startDistance, `expected fall, ${startDistance} -> ${endDistance}`);
});

test('stepPod is deterministic for identical inputs', () => {
  const a = { x: 100, y: 100, vx: 200, vy: 40 };
  const b = { x: 100, y: 100, vx: 200, vy: 40 };
  for (let i = 0; i < 120; i += 1) { stepPod(a, [planet], 1 / 120); stepPod(b, [planet], 1 / 120); }
  assert.deepEqual(a, b);
});

test('simulateFlight returns the requested samples and bends under gravity', () => {
  const start = { x: 100, y: 300, vx: 260, vy: 0 };
  const points = simulateFlight(start, [planet], { seconds: 2, step: 1 / 120, sampleEvery: 12 });
  assert.equal(points.length, 20);
  assert.deepEqual(points[0], { x: 100, y: 300 });
  const last = points[points.length - 1];
  assert.ok(last.y > 300, 'path bends toward the planet below the line of flight');
});
