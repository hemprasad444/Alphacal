// Bundle the functions into lib/index.js. @rei/shared is inlined from the repo so the
// deployed package needs nothing from outside this folder; npm dependencies stay external
// and are installed by Cloud Build from package.json.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  packages: 'external',
  alias: { '@rei/shared': fileURLToPath(new URL('../packages/shared/src/index.ts', import.meta.url)) },
  logLevel: 'info',
});
