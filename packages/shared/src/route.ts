// Which model answers. A rules pass, so routing costs no extra model call.

export type Tier = 'fast' | 'deep';

export const MODELS: Record<Tier, string> = {
  /** Quick chat, excuses, meals: lowest latency. */
  fast: 'claude-haiku-4-5',
  /** Planning, analysis and reviews: the strongest model. */
  deep: 'claude-opus-5-5',
};

// Word stems: "stall" also matches "stalled", "plan" matches "planning".
const DEEP = /\b(plan|program|routine|split|periodi[sz]|analy[sz]|review|progress|plateau|stall|stuck|adjust|rebuild|redesign|deload|why (am|is|are|do|does|did|can'?t)|compar|trend|break ?down|explain|strateg)/i;

export function route(text: string): Tier {
  return DEEP.test(text) ? 'deep' : 'fast';
}
