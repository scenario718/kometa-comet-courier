// rendering.js — every visual in KOMETA is drawn here on one canvas: the
// parallax starfield, shaded planets with atmosphere halos, the glowing
// delivery station, the comet pod and its trail, the dotted aim trajectory,
// the HUD and the title / level-clear / game-over screens. No image assets:
// deep indigo space, coral and gold planets, a mint home world.

import { predictPath } from './trajectory.js';
import { stationPositionAt, WORLD } from './planets.js';
import { createRng } from './rng.js';
import { launchOrigin, launchVelocity, gravityBodies, POD_RADIUS } from './game-state.js';

const KIND_COLORS = {
  home: { light: '#a8f0d1', mid: '#3ecf8e', dark: '#14532d', glow: 'rgba(62,207,142,' },
  coral: { light: '#ffb59d', mid: '#ff7a59', dark: '#8f2d1b', glow: 'rgba(255,122,89,' },
  gold: { light: '#ffe3a3', mid: '#ffc24b', dark: '#8a5a13', glow: 'rgba(255,194,75,' },
  teal: { light: '#a7f3ea', mid: '#3fd9c0', dark: '#0f5f55', glow: 'rgba(63,217,192,' },
  violet: { light: '#d3c2ff', mid: '#9a7bff', dark: '#3d2a7a', glow: 'rgba(154,123,255,' },
  rose: { light: '#ffc2d6', mid: '#ff6b9d', dark: '#7c1d40', glow: 'rgba(255,107,157,' },
};

const INK = '#eef2ff';
const INK_DIM = 'rgba(220,228,255,0.72)';
const GOLD = '#ffc24b';
const PANEL = 'rgba(10,14,44,0.88)';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let starKey = '';
  let starLayers = [];
  let particles = [];

  function ensureStars(game) {
    const key = `${game.layout.seed}:${game.levelNumber}`;
    if (key === starKey) return;
    starKey = key;
    const rng = createRng(game.layout.seed * 31 + game.levelNumber * 7);
    starLayers = [0.25, 0.6, 1].map((depth, layer) => {
      const stars = [];
      const count = 46 + layer * 30;
      for (let i = 0; i < count; i += 1) {
        stars.push({
          x: rng.between(0, WORLD.width),
          y: rng.between(0, WORLD.height),
          r: rng.between(0.6, 1.1 + depth * 1.3),
          phase: rng.between(0, Math.PI * 2),
          depth,
        });
      }
      return stars;
    });
  }

  function spawnBurst(x, y, color, count = 16, speed = 130) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const pace = (0.3 + Math.random() * 0.7) * speed;
      particles.push({
        x, y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.5,
        color,
        size: 1.5 + Math.random() * 2.4,
      });
    }
  }

  function draw(game, pointer, dt) {
    ensureStars(game);
    drawSky(game);
    drawPlanets(game);
    drawStation(game);
    if (game.phase === 'aiming') drawAim(game);
    if (game.flight) drawFlight(game);
    stepParticles(dt);
    drawHud(game);
    if (game.phase === 'title') drawTitle(game);
    if (game.phase === 'level-clear') drawLevelClear(game);
    if (game.phase === 'game-over') drawGameOver(game);
  }

  function drawSky(game) {
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    gradient.addColorStop(0, '#0a1038');
    gradient.addColorStop(0.55, '#101a4e');
    gradient.addColorStop(1, '#070b2a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    for (const layer of starLayers) {
      for (const star of layer) {
        const drift = (game.levelTime * 2.2 * star.depth) % WORLD.width;
        const x = (star.x + drift) % WORLD.width;
        const twinkle = 0.55 + 0.45 * Math.sin(game.levelTime * 1.7 + star.phase);
        ctx.globalAlpha = twinkle * (0.35 + star.depth * 0.6);
        ctx.fillStyle = '#dfe8ff';
        ctx.beginPath();
        ctx.arc(x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPlanets(game) {
    drawPlanet(game.layout.home, game.levelTime);
    for (const planet of game.layout.planets) drawPlanet(planet, game.levelTime);
  }

  function drawPlanet(planet, time) {
    const colors = KIND_COLORS[planet.kind] || KIND_COLORS.coral;
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, planet.atmosphere, 0, Math.PI * 2);
    ctx.fillStyle = `${colors.glow}${0.05 + 0.015 * Math.sin(time * 1.3 + planet.x)})`;
    ctx.fill();

    const sphere = ctx.createRadialGradient(
      planet.x - planet.radius * 0.4, planet.y - planet.radius * 0.45, planet.radius * 0.15,
      planet.x, planet.y, planet.radius,
    );
    sphere.addColorStop(0, colors.light);
    sphere.addColorStop(0.55, colors.mid);
    sphere.addColorStop(1, colors.dark);
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2);
    ctx.fillStyle = sphere;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#0a1038';
    ctx.beginPath();
    ctx.arc(planet.x + planet.radius * 0.55, planet.y + planet.radius * 0.35, planet.radius * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    if (planet.kind === 'violet') drawRing(planet, colors);
    if (planet.kind === 'home') drawLaunchPad(planet, time);
  }

  function drawRing(planet, colors) {
    ctx.save();
    ctx.translate(planet.x, planet.y);
    ctx.rotate(-0.32);
    ctx.scale(1, 0.34);
    ctx.beginPath();
    ctx.arc(0, 0, planet.radius * 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = `${colors.glow}0.55)`;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }

  function drawLaunchPad(planet, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, planet.radius + 7 + pulse * 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(168,240,209,${0.35 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '600 12px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOME', planet.x, planet.y + planet.radius + 24);
  }

  function drawStation(game) {
    const station = game.layout.station;
    const at = stationPositionAt(station, game.levelTime);
    const pulse = 0.5 + 0.5 * Math.sin(game.levelTime * 3);

    ctx.beginPath();
    ctx.arc(at.x, at.y, station.radius + 16 + pulse * 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,194,75,${0.07 + pulse * 0.05})`;
    ctx.fill();

    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(game.levelTime * 0.5);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, station.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.fillRect(station.radius + 2, -3, 7, 6);
    ctx.fillRect(-station.radius - 9, -3, 7, 6);
    ctx.restore();

    const hub = ctx.createRadialGradient(at.x - 5, at.y - 6, 2, at.x, at.y, station.radius);
    hub.addColorStop(0, '#fff6dd');
    hub.addColorStop(0.6, GOLD);
    hub.addColorStop(1, '#b97e1e');
    ctx.beginPath();
    ctx.arc(at.x, at.y, station.radius, 0, Math.PI * 2);
    ctx.fillStyle = hub;
    ctx.fill();

    ctx.fillStyle = `rgba(255,246,221,${0.65 + pulse * 0.35})`;
    ctx.beginPath();
    ctx.arc(at.x, at.y, 3.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = INK;
    ctx.font = '600 12px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STATION', at.x, at.y + station.radius + 28);
  }

  function drawAim(game) {
    const origin = launchOrigin(game);
    const velocity = launchVelocity(game);
    const path = predictPath(origin, velocity, gravityBodies(game), { seconds: 3.4, maxPoints: 52 });
    path.forEach((point, i) => {
      if (i % 2 === 1) return;
      const fade = 1 - i / path.length;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,227,163,${0.25 + fade * 0.65})`;
      ctx.fill();
    });

    const home = game.layout.home;
    ctx.beginPath();
    ctx.arc(home.x, home.y, home.radius + 16, -Math.PI * 0.75, -Math.PI * 0.75 + game.aim.power * Math.PI * 1.5);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = INK_DIM;
    ctx.font = '11px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('power', home.x, home.y - home.radius - 24);

    drawPod(origin.x, origin.y, game.aim.angle);
  }

  function drawFlight(game) {
    const { pod, trail } = game.flight;
    for (let i = 1; i < trail.length; i += 1) {
      const fade = i / trail.length;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.strokeStyle = `rgba(255,150,110,${fade * 0.55})`;
      ctx.lineWidth = 1 + fade * 2.4;
      ctx.stroke();
    }
    const angle = Math.atan2(pod.vy, pod.vx);
    drawPod(pod.x, pod.y, angle);
  }

  function drawPod(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#fff6dd';
    ctx.beginPath();
    ctx.ellipse(0, 0, POD_RADIUS + 3.5, POD_RADIUS, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff7a59';
    ctx.beginPath();
    ctx.moveTo(POD_RADIUS + 3.5, 0);
    ctx.lineTo(POD_RADIUS - 2, -POD_RADIUS + 1);
    ctx.lineTo(POD_RADIUS - 2, POD_RADIUS - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#101a4e';
    ctx.beginPath();
    ctx.arc(1.5, 0, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function stepParticles(dt) {
    particles = particles.filter((p) => p.life < p.maxLife);
    for (const p of particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(game) {
    ctx.fillStyle = 'rgba(7,11,42,0.55)';
    ctx.fillRect(0, 0, WORLD.width, 54);
    ctx.fillStyle = INK;
    ctx.font = '700 21px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score ${game.score}`, 22, 36);

    ctx.textAlign = 'center';
    ctx.font = '600 16px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(`Level ${game.levelNumber}`, WORLD.width / 2 - 90, 36);
    for (let i = 0; i < game.layout.quota; i += 1) {
      ctx.beginPath();
      ctx.arc(WORLD.width / 2 - 20 + i * 24, 29, 7, 0, Math.PI * 2);
      ctx.fillStyle = i < game.delivered ? GOLD : 'rgba(220,228,255,0.25)';
      ctx.fill();
    }
    ctx.fillStyle = INK_DIM;
    ctx.font = '12px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText('delivered', WORLD.width / 2 + 8, 48);

    ctx.textAlign = 'right';
    ctx.fillStyle = INK;
    ctx.font = '600 16px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText('Pods', WORLD.width - 150, 36);
    for (let i = 0; i < game.podsLeft; i += 1) {
      ctx.beginPath();
      ctx.arc(WORLD.width - 128 + i * 22, 29, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff6dd';
      ctx.fill();
      ctx.fillStyle = '#ff7a59';
      ctx.beginPath();
      ctx.arc(WORLD.width - 125 + i * 22, 29, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6dd';
    }

    if (game.flight && game.flight.grazes > 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = GOLD;
      ctx.font = '700 19px "Trebuchet MS", Verdana, sans-serif';
      ctx.fillText(`Combo ×${1 + game.flight.grazes}`, 22, WORLD.height - 20);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = INK_DIM;
    ctx.font = '12px "Trebuchet MS", Verdana, sans-serif';
    const hint = game.phase === 'aiming'
      ? 'Move the mouse to aim — click or Space to launch · R restart · M sound'
      : 'R restart · M sound';
    ctx.fillText(hint, WORLD.width - 18, WORLD.height - 14);
  }

  function panel(width, height) {
    const x = (WORLD.width - width) / 2;
    const y = (WORLD.height - height) / 2;
    ctx.fillStyle = PANEL;
    ctx.strokeStyle = 'rgba(255,194,75,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 18);
    ctx.fill();
    ctx.stroke();
    return { x, y };
  }

  function drawTitle(game) {
    ctx.fillStyle = 'rgba(7,11,42,0.45)';
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    const cometX = WORLD.width / 2 - 250;
    const cometY = 218;
    for (let i = 0; i < 26; i += 1) {
      ctx.beginPath();
      ctx.arc(cometX - i * 9, cometY - i * 3.4, 7 - i * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,150,110,${0.5 - i * 0.018})`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cometX, cometY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff6dd';
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = '700 92px Georgia, "Times New Roman", serif';
    ctx.fillText('KOMETA', WORLD.width / 2 + 30, 268);
    ctx.fillStyle = GOLD;
    ctx.font = '600 25px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText('C o m e t   C o u r i e r', WORLD.width / 2, 312);

    ctx.fillStyle = INK_DIM;
    ctx.font = '17px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText('Sling delivery pods around real gravity. Graze an atmosphere to build your combo,', WORLD.width / 2, 396);
    ctx.fillText('dock at the glowing station, and mind the pod supply — space is deep and empty.', WORLD.width / 2, 424);

    ctx.fillStyle = INK;
    ctx.font = '600 19px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText('Click or press Space to fly your first delivery', WORLD.width / 2, 492);
  }

  function drawLevelClear(game) {
    const { x, y } = panel(520, 300);
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = '700 40px Georgia, "Times New Roman", serif';
    ctx.fillText('Route complete', WORLD.width / 2, y + 78);
    ctx.fillStyle = INK;
    ctx.font = '18px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(`Level ${game.levelNumber} delivered in full.`, WORLD.width / 2, y + 128);
    ctx.fillText(`Score ${game.score} — spare pods banked as a bonus.`, WORLD.width / 2, y + 160);
    ctx.fillStyle = INK_DIM;
    ctx.font = '600 16px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText('Click or press Space for the next route', WORLD.width / 2, y + 232);
    void x;
  }

  function drawGameOver(game) {
    const { x, y } = panel(520, 320);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff9d85';
    ctx.font = '700 40px Georgia, "Times New Roman", serif';
    ctx.fillText('Out of pods', WORLD.width / 2, y + 78);
    ctx.fillStyle = INK;
    ctx.font = '18px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(`The route ends at level ${game.levelNumber}.`, WORLD.width / 2, y + 128);
    ctx.fillText(`Final score ${game.score}`, WORLD.width / 2, y + 162);
    ctx.fillStyle = INK_DIM;
    ctx.font = '600 16px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText('Press R or click to fly again', WORLD.width / 2, y + 244);
    void x;
  }

  return { draw, spawnBurst };
}
