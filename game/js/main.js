// main.js — KOMETA's boot and heartbeat: build the game, wire input and
// sound, run a fixed-timestep loop, and paint every frame. A ?scene= query
// (title, play, clear, over) sets up a genuine game state for screenshots;
// ?seed= picks the sky. Neither changes how the game plays for a visitor.

import { createGame, startRun, aimFromPoint, launchPod, updateGame, nextLevel } from './game-state.js';
import { stationPositionAt } from './planets.js';
import { createRenderer } from './rendering.js';
import { createAudio } from './audio.js';
import { attachInput } from './input.js';

const FIXED_DT = 1 / 60;

const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') ?? '', 10) || 20261117;

const canvas = document.getElementById('game');
const game = createGame(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

attachInput(canvas, game, {
  onGesture: () => audio.unlock(),
  onMute: () => audio.toggleMute(),
});

setupScene(params.get('scene'));

// The play scene holds its mid-flight frame still for the screenshot; every
// other scene (and normal play) runs the loop as usual.
const holdFrame = params.get('scene') === 'play';

let previous = performance.now();
let carry = 0;
function frame(now) {
  const elapsed = Math.min(0.1, (now - previous) / 1000);
  previous = now;
  carry += elapsed;
  while (carry >= FIXED_DT && !holdFrame) {
    updateGame(game, FIXED_DT);
    carry -= FIXED_DT;
  }
  if (holdFrame) carry = 0;
  drainEvents();
  renderer.draw(game, null, elapsed);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Sound and particles answer the state machine's event queue.
function drainEvents() {
  for (const name of game.events.splice(0)) {
    audio.play(name);
    if (name === 'delivered') {
      const at = stationPositionAt(game.layout.station, game.levelTime);
      renderer.spawnBurst(at.x, at.y, '#ffc24b', 22, 160);
    } else if (name === 'crash' && game.lastFlightEnd) {
      renderer.spawnBurst(game.lastFlightEnd.x, game.lastFlightEnd.y, '#ff7a59', 20, 150);
    } else if (name === 'lost' && game.lastFlightEnd) {
      renderer.spawnBurst(game.lastFlightEnd.x, game.lastFlightEnd.y, '#9a7bff', 10, 70);
    } else if (name === 'graze' && game.flight) {
      renderer.spawnBurst(game.flight.pod.x, game.flight.pod.y, '#ffe3a3', 6, 60);
    }
  }
}

// Screenshot scenes: each one drives the real game into the named state
// through the same verbs a player uses, so a shot is the game itself.
function setupScene(scene) {
  if (!scene || scene === 'title') return;
  if (scene === 'play') {
    startRun(game);
    const station = game.layout.station;
    aimFromPoint(game, station.x, station.y - 210);
    launchPod(game);
    for (let i = 0; i < 88 && game.phase === 'flying'; i += 1) updateGame(game, FIXED_DT);
    if (game.phase !== 'flying') {
      startRun(game);
      aimFromPoint(game, station.x, station.y - 120);
    }
    game.events.length = 0;
    return;
  }
  if (scene === 'clear') {
    startRun(game);
    game.delivered = game.layout.quota;
    game.score = 100 * game.layout.quota + 25 + game.podsLeft * 50;
    game.phase = 'level-clear';
    game.events.length = 0;
    return;
  }
  if (scene === 'over') {
    startRun(game);
    nextLevel(game);
    nextLevel(game);
    game.score = 1175;
    game.podsLeft = 0;
    game.phase = 'game-over';
    game.events.length = 0;
  }
}

// A handle for automated play-tests and curious players alike.
window.__kometa = game;
