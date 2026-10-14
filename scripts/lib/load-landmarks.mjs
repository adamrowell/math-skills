/**
 * Loads src/apps/landmarks/data/landmarks.ts from a Node script (bundled in memory with esbuild,
 * which Vite already ships), so the scripts and the app read the same catalog.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const repoRoot = root;

export async function loadLandmarks() {
  const esbuild = require('esbuild');
  const out = esbuild.buildSync({
    entryPoints: [join(root, 'src/apps/landmarks/data/landmarks.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'error',
  });
  const code = out.outputFiles[0].text;
  const mod = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  return mod.LANDMARKS;
}
