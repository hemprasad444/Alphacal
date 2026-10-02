import Anthropic from '@anthropic-ai/sdk';
import { defineSecret } from 'firebase-functions/params';

/** Set with: firebase functions:secrets:set ANTHROPIC_API_KEY */
export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

let client: Anthropic | null = null;

/** One client per instance, so connections are reused across requests. */
export function claude(): Anthropic {
  client ??= new Anthropic({ apiKey: ANTHROPIC_API_KEY.value(), maxRetries: 1 });
  return client;
}
