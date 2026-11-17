// main.ts — KOMETA's hand-in program (Node 22, standard library only).
//
// The game itself is the static site in game/: plain files a desktop browser
// opens offline. This program packages it for the judges — it copies game/
// and screenshots/ into the output directory and writes dossier.json there
// with the vendored make.fun library, so the dossier is exactly the bytes
// the library produces from those files. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR names the output directory:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The sealed gate's caps, handed to the library so an output it would
// refuse fails here first instead of after submission.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  const root = dirname(fileURLToPath(import.meta.url));
  const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  mkdirSync(out, { recursive: true });
  cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });

  const shotsOut = join(out, 'screenshots');
  mkdirSync(shotsOut, { recursive: true });
  const shotsIn = join(root, 'screenshots');
  if (existsSync(shotsIn)) cpSync(shotsIn, shotsOut, { recursive: true });

  writeFileSync(join(out, 'dossier.json'), buildDossier(out, GATE_CAPS));
}

handIn();
