// Unit tests for KOMETA's seeded random generator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../game/js/rng.js';

test('createRng repeats the same sequence for the same seed', () => {
  const first = createRng(1234);
  const second = createRng(1234);
  const firstRun = [first.next(), first.next(), first.next(), first.next()];
  const secondRun = [second.next(), second.next(), second.next(), second.next()];
  assert.deepEqual(firstRun, secondRun);
});

test('createRng gives different sequences for different seeds', () => {
  const a = createRng(7);
  const b = createRng(8);
  assert.notEqual(a.next(), b.next());
});

test('range helpers stay inside their bounds', () => {
  const rng = createRng(99);
  for (let i = 0; i < 200; i += 1) {
    const value = rng.between(5, 9);
    assert.ok(value >= 5 && value < 9, `between out of bounds: ${value}`);
    const whole = rng.intBetween(2, 4);
    assert.ok(Number.isInteger(whole) && whole >= 2 && whole <= 4);
  }
});

test('pick returns an element of the array', () => {
  const rng = createRng(3);
  const items = ['a', 'b', 'c'];
  for (let i = 0; i < 30; i += 1) assert.ok(items.includes(rng.pick(items)));
});
