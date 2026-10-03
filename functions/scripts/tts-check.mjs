// Hear an ElevenLabs model and voice before deploying, through the same code the tts function runs.
//   ELEVENLABS_KEY=... node scripts/tts-check.mjs [model] [voice id] ["text"]
// Writes rei-tts-check.mp3 here and prints how long the first audio took.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const key = process.env.ELEVENLABS_KEY;
if (!key) {
  console.error('Set ELEVENLABS_KEY first.');
  process.exit(1);
}
const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(tmpdir(), 'rei-tts-check.mjs');
await build({
  stdin: { contents: "export { speak } from './src/elevenlabs.ts'; export { DEFAULT_VOICE } from '@rei/shared';", resolveDir: root, loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'error',
});
const { speak, DEFAULT_VOICE } = await import(out);

const [model = 'eleven_v4_turbo', voice = DEFAULT_VOICE, text = '[firm] You skipped the gym again. [sighs] I get it, the day was long. [encouraging] But twenty minutes is still twenty minutes. Go now.'] = process.argv.slice(2);
const chunks = [];
const t0 = Date.now();
let first = 0;
try {
  await speak({ key, model, voice, text, onAudio: c => (first ||= Date.now() - t0, chunks.push(c)) });
} catch (e) {
  console.error(`FAILED (${model}): ${e.message}`);
  process.exit(1);
}
const file = join(process.cwd(), 'rei-tts-check.mp3');
writeFileSync(file, Buffer.concat(chunks));
console.log(`OK ${model}: first audio ${first} ms, total ${Date.now() - t0} ms, ${Buffer.concat(chunks).length} bytes → ${file}`);
