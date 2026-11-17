// trajectory.js — the dotted aim preview. It flies the very same physics as the
// real pod, so the path the player sees is the path the pod will take.

import { simulateFlight } from './physics.js';

// The fixed physics step (s) shared by the live flight and this preview.
export const PHYSICS_STEP = 1 / 120;

// Predict a launch: origin {x, y}, velocity {x, y} in px/s, under the planets'
// gravity, for `seconds` of flight, as at most maxPoints path points.
export function predictPath(origin, velocity, planets, { seconds = 3.2, maxPoints = 46 } = {}) {
  const totalSteps = Math.round(seconds / PHYSICS_STEP);
  const sampleEvery = Math.max(1, Math.ceil(totalSteps / maxPoints));
  const start = { x: origin.x, y: origin.y, vx: velocity.x, vy: velocity.y };
  return simulateFlight(start, planets, { seconds, step: PHYSICS_STEP, sampleEvery });
}
