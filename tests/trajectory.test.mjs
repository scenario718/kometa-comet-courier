// Unit tests for the aim trajectory preview: it must mirror the real physics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateFlight } from '../game/js/physics.js';
import { predictPath } from '../game/js/trajectory.js';

const planets = [
  { x: 500, y: 300, radius: 34, mu: 120000 },
  { x: 850, y: 520, radius: 26, mu: 70000 },
];

test('predictPath starts at the launch point and honours the point budget', () => {
  const path = predictPath({ x: 90, y: 400 }, { x: 300, y: -60 }, planets, { seconds: 3, maxPoints: 40 });
  assert.ok(path.length > 10 && path.length <= 40);
  assert.deepEqual(path[0], { x: 90, y: 400 });
});

test('predictPath matches a manual simulateFlight run point for point', () => {
  const start = { x: 90, y: 400, vx: 310, vy: -80 };
  const predicted = predictPath({ x: start.x, y: start.y }, { x: start.vx, y: start.vy }, planets, { seconds: 2, maxPoints: 25 });
  const flown = simulateFlight(start, planets, { seconds: 2, step: 1 / 120, sampleEvery: 10 });
  assert.equal(predicted.length, flown.length);
  for (let i = 0; i < predicted.length; i += 1) {
    assert.ok(Math.abs(predicted[i].x - flown[i].x) < 1e-9, `x drift at ${i}`);
    assert.ok(Math.abs(predicted[i].y - flown[i].y) < 1e-9, `y drift at ${i}`);
  }
});

test('predictPath is deterministic', () => {
  const a = predictPath({ x: 0, y: 0 }, { x: 200, y: 100 }, planets, { seconds: 2, maxPoints: 30 });
  const b = predictPath({ x: 0, y: 0 }, { x: 200, y: 100 }, planets, { seconds: 2, maxPoints: 30 });
  assert.deepEqual(a, b);
});
