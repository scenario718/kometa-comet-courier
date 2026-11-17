// Unit tests for seeded level generation: fair, separated, escalating layouts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel, stationPositionAt, WORLD } from '../game/js/planets.js';

test('generateLevel is deterministic for the same seed and level', () => {
  assert.deepEqual(generateLevel(42, 3), generateLevel(42, 3));
  assert.notDeepEqual(generateLevel(42, 3), generateLevel(43, 3));
});

test('the station never overlaps a planet and sits on the far side', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    for (let level = 1; level <= 6; level += 1) {
      const layout = generateLevel(seed, level);
      assert.ok(layout.station.x > WORLD.width * 0.6, 'station on the right side');
      for (const planet of layout.planets) {
        const gap = Math.hypot(planet.x - layout.station.x, planet.y - layout.station.y);
        assert.ok(gap > planet.radius + layout.station.radius + 24, `station too close, seed ${seed} level ${level}`);
      }
    }
  }
});

test('planets never overlap each other or the home planet', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const layout = generateLevel(seed, 5);
    const bodies = [layout.home, ...layout.planets];
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        const gap = Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y);
        assert.ok(gap > bodies[i].radius + bodies[j].radius + 30, `overlap seed ${seed}: ${i}/${j}`);
      }
    }
  }
});

test('quota and pod supply escalate with the level', () => {
  const first = generateLevel(5, 1);
  const later = generateLevel(5, 4);
  assert.equal(first.quota, 2);
  assert.ok(later.quota > first.quota);
  assert.ok(first.pods >= first.quota + 2, 'pods leave room for mistakes');
  assert.ok(later.planets.length >= first.planets.length);
});

test('the station stands still on early levels and moves later', () => {
  const still = generateLevel(5, 1).station;
  assert.deepEqual(stationPositionAt(still, 0), stationPositionAt(still, 9));
  const moving = generateLevel(5, 4).station;
  const a = stationPositionAt(moving, 0);
  const b = stationPositionAt(moving, 3);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 1, 'station drifts on level 4');
});
