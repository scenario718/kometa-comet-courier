// planets.js — seeded level layouts for KOMETA. Every level deals a home planet
// on the left, a delivery station on the right and a field of gravity planets
// between them, all placed with clear space around them so a slingshot route
// always exists. Higher levels add planets, raise the quota and set the
// station drifting.

import { createRng } from './rng.js';

export const WORLD = { width: 1280, height: 800 };

// A planet's atmosphere (the graze zone) reaches this far beyond its surface.
export const ATMOSPHERE_FACTOR = 1.55;

const PLANET_KINDS = ['coral', 'gold', 'teal', 'violet', 'rose'];

function makePlanet(rng, x, y, radius, kind) {
  return {
    x,
    y,
    radius,
    mu: radius * radius * rng.between(200, 300),
    kind,
    atmosphere: radius * ATMOSPHERE_FACTOR,
  };
}

// The station's position at time t (seconds): it circles its anchor on later
// levels and hangs still on the early ones.
export function stationPositionAt(station, t) {
  if (!station.orbitRadius) return { x: station.x, y: station.y };
  const angle = station.phase + t * station.orbitSpeed;
  return {
    x: station.x + Math.cos(angle) * station.orbitRadius,
    y: station.y + Math.sin(angle) * station.orbitRadius * 0.7,
  };
}

// Deal one level. Deterministic in (seed, levelNumber): the same pair always
// deals the same sky, which keeps retries fair and tests honest.
export function generateLevel(seed, levelNumber) {
  const rng = createRng(seed * 100003 + levelNumber * 7919 + 17);

  const home = makePlanet(rng, 118, rng.between(320, 480), 30, 'home');

  const station = {
    x: rng.between(1020, 1160),
    y: rng.between(150, 650),
    radius: 17,
    orbitRadius: levelNumber >= 3 ? rng.between(24, 44) : 0,
    orbitSpeed: rng.between(0.15, 0.3),
    phase: rng.between(0, Math.PI * 2),
  };

  const planetCount = Math.min(1 + levelNumber, 6);
  const planets = [];
  let guard = 0;
  while (planets.length < planetCount && guard < 400) {
    guard += 1;
    const radius = rng.between(17, 42);
    const candidate = makePlanet(rng, rng.between(300, 980), rng.between(90, 710), radius, rng.pick(PLANET_KINDS));
    if (!hasClearSpace(candidate, home, station, planets)) continue;
    planets.push(candidate);
  }

  const quota = Math.min(2 + (levelNumber - 1), 5);
  return {
    level: levelNumber,
    seed,
    home,
    planets,
    station,
    quota,
    pods: quota + 2,
  };
}

// A new planet must clear the home planet, the station's whole orbit and every
// planet already placed, with room for a pod to thread between them.
function hasClearSpace(candidate, home, station, placed) {
  const bodies = [home, ...placed];
  for (const body of bodies) {
    const gap = Math.hypot(candidate.x - body.x, candidate.y - body.y);
    if (gap <= candidate.radius + body.radius + 36) return false;
  }
  const stationGap = Math.hypot(candidate.x - station.x, candidate.y - station.y);
  return stationGap > candidate.radius + station.radius + 30 + station.orbitRadius;
}
