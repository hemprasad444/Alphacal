import Anthropic from '@anthropic-ai/sdk';
import type { ChatTurn } from './rei';

// How the app reaches Claude, in order of preference:
//  1. EXPO_PUBLIC_REI_API_URL: your own proxy that forwards /v1/messages and adds
//     the API key server-side. Use this for any build you hand to someone else.
//  2. EXPO_PUBLIC_ANTHROPIC_API_KEY: calls the API straight from the phone. The key
//     ships inside the app bundle, so keep this to local development.
//  3. Neither set: REI answers from the offline replies in rei.ts.
const PROXY_URL = process.env.EXPO_PUBLIC_REI_API_URL;
const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

export const MODEL = 'claude-opus-5-5';

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (client) return client;
  if (PROXY_URL) {
    client = new Anthropic({ baseURL: PROXY_URL, apiKey: 'proxy', dangerouslyAllowBrowser: true });
  } else if (API_KEY) {
    client = new Anthropic({ apiKey: API_KEY, dangerouslyAllowBrowser: true });
  }
  return client;
}

export const isOnline = () => !!(PROXY_URL || API_KEY);

/**
 * One REI reply. Returns null when Claude is unavailable or declines, so the
 * caller can fall back to an offline answer.
 */
export async function askClaude(system: string, turns: ChatTurn[]): Promise<string | null> {
  const c = getClient();
  if (!c || !turns.length) return null;
  try {
    const response = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Short chat replies: low effort keeps latency down.
      output_config: { effort: 'low' },
      // On a safety decline, let the API re-run the request on its recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: turns,
    });
    if (response.stop_reason === 'refusal') return null;
    const text = response.content
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    return text || null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.warn(`REI: Claude API error ${e.status ?? ''}: ${e.message}`);
    else console.warn('REI: could not reach Claude', e);
    return null;
  }
}
