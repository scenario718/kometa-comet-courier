// Unit tests for KOMETA's game state machine: phases, scoring, grazes, losses.
// Hand-built layouts with zero gravity keep flights straight and predictable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startRun, aimFromPoint, launchPod, updateGame, nextLevel } from '../game/js/game-state.js';

function flatLayout(overrides = {}) {
  return {
    level: 1,
    seed: 1,
    home: { x: 100, y: 400, radius: 30, mu: 0, kind: 'home', atmosphere: 46 },
    planets: [],
    station: { x: 600, y: 400, radius: 17, orbitRadius: 0, orbitSpeed: 0, phase: 0 },
    quota: 2,
    pods: 3,
    ...overrides,
  };
}

function runUntilSettled(game, seconds = 6) {
  for (let t = 0; t < seconds * 60 && game.phase === 'flying'; t += 1) updateGame(game, 1 / 60);
}

test('a new game waits on the title screen, then starts aiming', () => {
  const game = createGame(5);
  assert.equal(game.phase, 'title');
  startRun(game);
  assert.equal(game.phase, 'aiming');
  assert.equal(game.score, 0);
  assert.equal(game.podsLeft, game.layout.pods);
});

test('launching spends a pod and puts the game in flight', () => {
  const game = createGame(5);
  startRun(game);
  game.layout = flatLayout();
  game.podsLeft = 3;
  aimFromPoint(game, 600, 400);
  launchPod(game);
  assert.equal(game.phase, 'flying');
  assert.equal(game.podsLeft, 2);
  assert.ok(game.events.includes('launch'));
});

test('a straight delivery scores 100 and returns to aiming', () => {
  const game = createGame(5);
  startRun(game);
  game.layout = flatLayout();
  game.podsLeft = 3;
  game.delivered = 0;
  aimFromPoint(game, 600, 400);
  launchPod(game);
  runUntilSettled(game);
  assert.equal(game.delivered, 1);
  assert.equal(game.score, 100);
  assert.equal(game.phase, 'aiming');
  assert.ok(game.events.includes('delivered'));
});

test('grazing an atmosphere adds style points and lifts the delivery score', () => {
  const layout = flatLayout({
    planets: [{ x: 350, y: 428, radius: 20, mu: 0, kind: 'coral', atmosphere: 31 }],
  });
  const game = createGame(5);
  startRun(game);
  game.layout = layout;
  game.podsLeft = 3;
  game.delivered = 0;
  aimFromPoint(game, 600, 400);
  launchPod(game);
  runUntilSettled(game);
  assert.equal(game.delivered, 1);
  assert.equal(game.score, 25 + 200, 'graze 25 plus a doubled delivery (combo x2)');
  assert.ok(game.events.includes('graze'));
});

test('crashing into a planet loses the pod with no score', () => {
  const layout = flatLayout({
    planets: [{ x: 350, y: 400, radius: 24, mu: 0, kind: 'gold', atmosphere: 37 }],
  });
  const game = createGame(5);
  startRun(game);
  game.layout = layout;
  game.podsLeft = 3;
  aimFromPoint(game, 600, 400);
  launchPod(game);
  runUntilSettled(game);
  assert.equal(game.delivered, 0);
  assert.equal(game.score, 0);
  assert.equal(game.phase, 'aiming');
  assert.ok(game.events.includes('crash'));
});

test('running out of pods before quota ends the game', () => {
  const game = createGame(5);
  startRun(game);
  game.layout = flatLayout({ pods: 1 });
  game.podsLeft = 1;
  aimFromPoint(game, 100, 60); // aim away into deep space
  launchPod(game);
  runUntilSettled(game, 30);
  assert.equal(game.phase, 'game-over');
  assert.ok(game.events.includes('game-over'));
});

test('meeting the quota clears the level with a pod bonus, then deals the next', () => {
  const game = createGame(5);
  startRun(game);
  game.layout = flatLayout({ quota: 1, pods: 3 });
  game.podsLeft = 3;
  game.delivered = 0;
  aimFromPoint(game, 600, 400);
  launchPod(game);
  runUntilSettled(game);
  assert.equal(game.phase, 'level-clear');
  assert.equal(game.score, 100 + 2 * 50, 'delivery plus 50 per pod left');
  nextLevel(game);
  assert.equal(game.phase, 'aiming');
  assert.equal(game.levelNumber, 2);
  assert.equal(game.delivered, 0);
});
