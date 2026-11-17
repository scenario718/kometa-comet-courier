// game-state.js — KOMETA's rules and state machine, kept free of canvas and
// audio so the whole game loop can be unit-tested. Phases: title, aiming,
// flying, level-clear, game-over. The renderer reads the state; the input
// layer calls the verbs (startRun, aimFromPoint, launchPod, nextLevel);
// updateGame advances time. Sound-worthy moments are queued in game.events
// for the shell (main.js) to drain into the audio module.

import { stepPod } from './physics.js';
import { PHYSICS_STEP } from './trajectory.js';
import { generateLevel, stationPositionAt, WORLD } from './planets.js';

export const POD_RADIUS = 5;
const DELIVERY_REACH = 10; // extra px beyond the station's rim that still docks
const GRAZE_POINTS = 25;
const DELIVERY_POINTS = 100;
const POD_BONUS_POINTS = 50; // per pod left when a level clears
const MIN_LAUNCH_SPEED = 140;
const MAX_LAUNCH_SPEED = 470;
const MAX_FLIGHT_SECONDS = 25;
const SPACE_MARGIN = 140; // px beyond the world edge before a pod is lost

export function createGame(seed = 1) {
  const layout = generateLevel(seed, 1);
  return {
    seed,
    phase: 'title',
    levelNumber: 1,
    layout,
    score: 0,
    podsLeft: layout.pods,
    delivered: 0,
    aim: { angle: 0, power: 0.55 },
    flight: null,
    levelTime: 0,
    events: [],
    lastOutcome: null,
    lastFlightEnd: null,
  };
}

export function startRun(game) {
  game.levelNumber = 1;
  game.score = 0;
  loadLevel(game);
  game.phase = 'aiming';
}

export function nextLevel(game) {
  game.levelNumber += 1;
  loadLevel(game);
  game.phase = 'aiming';
}

function loadLevel(game) {
  game.layout = generateLevel(game.seed, game.levelNumber);
  game.podsLeft = game.layout.pods;
  game.delivered = 0;
  game.flight = null;
  game.levelTime = 0;
}

// Aim from a pointer position: direction away from the home planet's centre,
// power growing with how far the pointer sits from it.
export function aimFromPoint(game, x, y) {
  const home = game.layout.home;
  const dx = x - home.x;
  const dy = y - home.y;
  game.aim.angle = Math.atan2(dy, dx);
  const distance = Math.hypot(dx, dy);
  game.aim.power = Math.min(1, Math.max(0, (distance - 40) / 300));
}

export function launchOrigin(game) {
  const home = game.layout.home;
  const reach = home.radius + POD_RADIUS + 3;
  return {
    x: home.x + Math.cos(game.aim.angle) * reach,
    y: home.y + Math.sin(game.aim.angle) * reach,
  };
}

export function launchVelocity(game) {
  const speed = MIN_LAUNCH_SPEED + game.aim.power * (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED);
  return { x: Math.cos(game.aim.angle) * speed, y: Math.sin(game.aim.angle) * speed };
}

export function gravityBodies(game) {
  return [game.layout.home, ...game.layout.planets];
}

export function launchPod(game) {
  if (game.phase !== 'aiming' || game.podsLeft <= 0) return false;
  const origin = launchOrigin(game);
  const velocity = launchVelocity(game);
  game.podsLeft -= 1;
  game.flight = {
    pod: { x: origin.x, y: origin.y, vx: velocity.x, vy: velocity.y },
    trail: [{ x: origin.x, y: origin.y }],
    time: 0,
    carry: 0,
    steps: 0,
    grazes: 0,
    grazeZones: new Map(),
    leftHome: false,
  };
  game.phase = 'flying';
  game.events.push('launch');
  return true;
}

export function updateGame(game, dt) {
  if (game.phase !== 'aiming' && game.phase !== 'flying') return;
  game.levelTime += dt;
  if (game.phase !== 'flying' || !game.flight) return;

  const flight = game.flight;
  flight.carry += dt;
  while (flight.carry >= PHYSICS_STEP && game.phase === 'flying') {
    flight.carry -= PHYSICS_STEP;
    stepFlight(game, PHYSICS_STEP);
  }
}

function stepFlight(game, dt) {
  const flight = game.flight;
  const layout = game.layout;
  stepPod(flight.pod, gravityBodies(game), dt);
  flight.time += dt;
  flight.steps += 1;
  if (flight.steps % 3 === 0) {
    flight.trail.push({ x: flight.pod.x, y: flight.pod.y });
    if (flight.trail.length > 900) flight.trail.shift();
  }

  const pod = flight.pod;
  const home = layout.home;
  if (!flight.leftHome && Math.hypot(pod.x - home.x, pod.y - home.y) > home.atmosphere) {
    flight.leftHome = true;
  }

  const stationAt = stationPositionAt(layout.station, game.levelTime);
  if (Math.hypot(pod.x - stationAt.x, pod.y - stationAt.y) <= layout.station.radius + DELIVERY_REACH) {
    return settleFlight(game, 'delivered');
  }

  for (let i = 0; i < layout.planets.length; i += 1) {
    const planet = layout.planets[i];
    const distance = Math.hypot(pod.x - planet.x, pod.y - planet.y);
    if (distance <= planet.radius + POD_RADIUS) return settleFlight(game, 'crash');
    watchGraze(game, i, planet, distance);
  }
  if (flight.leftHome) {
    const distance = Math.hypot(pod.x - home.x, pod.y - home.y);
    if (distance <= home.radius + POD_RADIUS) return settleFlight(game, 'crash');
  }

  if (pod.x < -SPACE_MARGIN || pod.x > WORLD.width + SPACE_MARGIN
    || pod.y < -SPACE_MARGIN || pod.y > WORLD.height + SPACE_MARGIN
    || flight.time > MAX_FLIGHT_SECONDS) {
    return settleFlight(game, 'lost');
  }
  return undefined;
}

// A graze pays when the pod leaves an atmosphere it entered without crashing:
// skimming the zone banks style points and raises this flight's combo.
function watchGraze(game, index, planet, distance) {
  const flight = game.flight;
  const zone = flight.grazeZones.get(index);
  if (!zone && distance < planet.atmosphere && distance > planet.radius + POD_RADIUS) {
    flight.grazeZones.set(index, 'inside');
  } else if (zone === 'inside' && distance >= planet.atmosphere) {
    flight.grazeZones.set(index, 'done');
    flight.grazes += 1;
    game.score += GRAZE_POINTS;
    game.events.push('graze');
  }
}

function settleFlight(game, outcome) {
  const grazes = game.flight ? game.flight.grazes : 0;
  if (game.flight) game.lastFlightEnd = { x: game.flight.pod.x, y: game.flight.pod.y, outcome };
  game.lastOutcome = outcome;
  game.flight = null;
  if (outcome === 'delivered') {
    game.delivered += 1;
    game.score += DELIVERY_POINTS * (1 + grazes);
    game.events.push('delivered');
    if (game.delivered >= game.layout.quota) {
      game.score += game.podsLeft * POD_BONUS_POINTS;
      game.phase = 'level-clear';
      game.events.push('level-clear');
      return;
    }
  } else {
    game.events.push(outcome); // 'crash' or 'lost'
  }
  if (game.podsLeft <= 0) {
    game.phase = 'game-over';
    game.events.push('game-over');
  } else {
    game.phase = 'aiming';
  }
}
