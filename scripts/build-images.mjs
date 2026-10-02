// Downloads the exercise photos from free-exercise-db (public domain) and writes small WebP
// thumbnails to hosting/exercises/<id>/<n>.webp for Firebase Hosting, where they're served
// with a one-year immutable cache. Files already built are skipped, so re-runs are quick.
//   node scripts/build-images.mjs [--limit N]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const OUT = 'hosting/exercises';
const WIDTH = 360;
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

// Read [id, ..., image count] rows straight from the generated library.
const lib = readFileSync('packages/shared/src/exercises/library.ts', 'utf8');
const rows = [...lib.matchAll(/^\s*\["([^"]+)",.*,(\d+)\],?$/gm)].map(m => [m[1], Number(m[2])]);
const jobs = rows.flatMap(([id, n]) => Array.from({ length: Math.min(n, 2) }, (_, i) => [id, i])).slice(0, limit);

let done = 0, skipped = 0, failed = 0, bytes = 0;
async function run([id, i]) {
  const file = join(OUT, id, `${i}.webp`);
  if (existsSync(file)) return skipped++;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${SRC}/${encodeURIComponent(id)}/${i}.jpg`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
      mkdirSync(join(OUT, id), { recursive: true });
      writeFileSync(file, out);
      bytes += out.length;
      return done++;
    } catch (e) {
      if (attempt === 2) {
        failed++;
        console.warn(`skip ${id}/${i}: ${e.message}`);
      }
    }
  }
}

// 12 downloads at a time.
const queue = [...jobs];
await Promise.all(Array.from({ length: 12 }, async () => {
  while (queue.length) await run(queue.shift());
}));
console.log(`Exercise images: ${done} built (${(bytes / 1024 / 1024).toFixed(1)} MB), ${skipped} already there, ${failed} failed, of ${jobs.length}.`);
