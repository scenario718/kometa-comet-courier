// rng.js — a small seeded random generator (mulberry32) so level layouts and
// starfields are reproducible: the same seed always deals the same sky.

export function createRng(seed) {
  let state = (seed >>> 0) || 1;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function between(min, max) {
    return min + next() * (max - min);
  }

  function intBetween(min, max) {
    return Math.floor(between(min, max + 1));
  }

  function pick(items) {
    return items[Math.floor(next() * items.length)];
  }

  return { next, between, intBetween, pick };
}
