// Create (or update) REI's live voice agent on ElevenLabs and save its id for the functions.
//   ELEVENLABS_KEY=... node scripts/agent-setup.mjs [llm]
// Writes ELEVENLABS_AGENT_ID into functions/.env.<project-id>. Run it again after changing
// the tools or settings below; it updates the same agent.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const key = process.env.ELEVENLABS_KEY;
if (!key) {
  console.error('Set ELEVENLABS_KEY first.');
  process.exit(1);
}
const root = fileURLToPath(new URL('..', import.meta.url));
const project = JSON.parse(readFileSync(join(root, '..', '.firebaserc'), 'utf8')).projects.default;
const envFile = join(root, `.env.${project}`);
const env = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
const envValue = name => env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim();

const out = join(tmpdir(), 'rei-agent-setup.mjs');
await build({
  stdin: { contents: "export { AGENT_TOOLS, DEFAULT_VOICE } from '@rei/shared';", resolveDir: root, loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'error',
});
const { AGENT_TOOLS, DEFAULT_VOICE } = await import(out);

const llm = process.argv[2] ?? 'gpt-6-luna';
const voice = envValue('TTS_VOICE_ID') || DEFAULT_VOICE;
const body = {
  name: 'REI',
  conversation_config: {
    agent: {
      language: 'en',
      first_message: 'Yo, what’s good?',
      // Replaced every session by the app with the user's own prompt (functions/src/live.ts).
      prompt: { prompt: 'You are REI, a personal fitness coach and friend.', llm, reasoning_effort: 'none', temperature: 0.8, tools: AGENT_TOOLS },
    },
    tts: { model_id: 'eleven_v4_turbo', voice_id: voice, expressive_mode: true },
    conversation: { max_duration_seconds: 900 },
  },
  platform_settings: {
    // Private: sessions need a token from our backend.
    auth: { enable_auth: true },
    overrides: {
      conversation_config_override: {
        agent: { prompt: { prompt: true }, first_message: true },
        tts: { voice_id: true },
      },
    },
  },
};

const api = (path, init = {}) =>
  fetch(`https://api.elevenlabs.io${path}`, { ...init, headers: { 'xi-api-key': key, 'Content-Type': 'application/json', ...init.headers } });

let id = envValue('ELEVENLABS_AGENT_ID');
let res = id ? await api(`/v1/convai/agents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }) : null;
if (!res || res.status === 404) {
  res = await api('/v1/convai/agents/create', { method: 'POST', body: JSON.stringify(body) });
  id = res.ok ? (await res.clone().json()).agent_id : id;
}
if (!res.ok) {
  console.error(`FAILED ${res.status}: ${(await res.text()).slice(0, 1500)}`);
  process.exit(1);
}
const line = `ELEVENLABS_AGENT_ID=${id}`;
writeFileSync(envFile, /^ELEVENLABS_AGENT_ID=.*$/m.test(env) ? env.replace(/^ELEVENLABS_AGENT_ID=.*$/m, line) : `${env.trimEnd()}\n${line}\n`);
console.log(`OK agent ${id} (llm ${llm}, voice ${voice}, eleven_v4_turbo) → saved to ${envFile}`);
console.log(`Dashboard: https://elevenlabs.io/app/agents/agents/${id}`);
