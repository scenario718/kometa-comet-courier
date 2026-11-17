// input.js — mouse and keyboard controls. The pointer aims the slingshot
// (direction and power come from its distance to the home planet), a click or
// Space flies the current screen forward, R restarts the run and M toggles
// the sound. Canvas coordinates are scaled into the game's 1280x800 world.

import { aimFromPoint, launchPod, startRun, nextLevel } from './game-state.js';
import { WORLD } from './planets.js';

export function attachInput(canvas, game, hooks = {}) {
  function toWorld(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (WORLD.width / rect.width),
      y: (event.clientY - rect.top) * (WORLD.height / rect.height),
    };
  }

  function advance() {
    hooks.onGesture?.();
    if (game.phase === 'title') {
      startRun(game);
      game.events.push('start');
    } else if (game.phase === 'aiming') {
      launchPod(game);
    } else if (game.phase === 'level-clear') {
      nextLevel(game);
      game.events.push('start');
    } else if (game.phase === 'game-over') {
      startRun(game);
      game.events.push('start');
    }
  }

  canvas.addEventListener('pointermove', (event) => {
    if (game.phase !== 'aiming') return;
    const point = toWorld(event);
    aimFromPoint(game, point.x, point.y);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (game.phase === 'aiming') {
      const point = toWorld(event);
      aimFromPoint(game, point.x, point.y);
    }
    advance();
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      advance();
    } else if (event.code === 'KeyR') {
      hooks.onGesture?.();
      startRun(game);
      game.events.push('start');
    } else if (event.code === 'KeyM') {
      hooks.onMute?.();
    }
  });

  return { advance };
}
