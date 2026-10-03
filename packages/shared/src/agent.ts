// The live voice agent (ElevenLabs): REI's prompt for a session, and the actions it can take.
// The tool names here must match the client tools the app registers (app/src/components/LiveVoice.tsx).
import { MEMORY_KINDS, type MemoryKind } from './memory';
import { PROFILE_KEYS, systemContext, systemRules, type ReiContext } from './rei';
import type { ProfileKey } from './types';

const ACTIONS = `If they tell you they ate something, react to how it fits what's left today, then call log_meal with your realistic estimate for the whole meal (Indian home portions unless they say otherwise). If they explicitly ask to change their goal, deadline, a body stat or a daily target, call update_vow once per value. When they tell you a lasting fact about themselves (diet, allergy, injury, schedule, equipment, likes, life constraints), call remember with a short third-person note. If they ask for a new or changed training plan, call rebuild_program and tell them the new week is on its way. Keep the conversation flowing around these actions and never mention tools.`;

/** The whole system prompt for one live session: personality, voice rules, actions and today's numbers. */
export function agentPrompt(x: ReiContext): string {
  return `${systemRules({ tough: x.tough, bro: x.bro, nudge: x.nudge, tools: false, voice: true, actions: ACTIONS })}\n\n${systemContext(x)}`;
}

export function agentGreeting(x: Pick<ReiContext, 'bro' | 'tough'>): string {
  return x.bro ? 'Yo, what’s good?' : x.tough ? 'REI here. Talk to me.' : 'Hey, it’s REI. What’s going on?';
}

const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra });
const num = (description: string) => ({ type: 'number', description });
const tool = (name: string, description: string, properties: Record<string, unknown>) => ({
  type: 'client',
  name,
  description,
  expects_response: true,
  response_timeout_secs: 10,
  parameters: { type: 'object', required: Object.keys(properties), properties },
});

/** ElevenLabs client tool configs for the agent; the app carries them out. */
export const AGENT_TOOLS = [
  tool('log_meal', 'Log a meal the user says they ate, as one estimate for the whole meal.', {
    name: str('Short name for the meal, e.g. "Dal rice and curd"'),
    kcal: num('Total calories'),
    protein: num('Protein, grams'),
    carbs: num('Carbohydrates, grams'),
    fat: num('Fat, grams'),
  }),
  tool('update_vow', 'Change one of the user’s goal, deadline, body stats or daily targets, only when they explicitly ask.', {
    field: str('Which value to change', { enum: [...PROFILE_KEYS] }),
    value: str('New value. Numbers as plain digits; deadline as YYYY-MM-DD.'),
  }),
  tool('remember', 'Keep a lasting fact about the user for all future conversations.', {
    fact: str('Short third-person note, e.g. "Vegetarian; eats eggs"'),
    kind: str('What kind of fact', { enum: [...MEMORY_KINDS] }),
  }),
  tool('rebuild_program', 'Rewrite this week’s training plan when the user asks for a new or changed plan.', {
    focus: str('What they want changed, in a few words'),
  }),
];

const NUMERIC: ProfileKey[] = ['weight', 'targetWeight', 'bf', 'targetBf', 'kcal', 'protein', 'carbs', 'fat', 'steps', 'sleep', 'sessions'];

/** One update_vow call → a safe profile change, or null when it isn't one. */
export function vowChange(field: unknown, value: unknown): [ProfileKey, string] | null {
  if (typeof field !== 'string' || !(PROFILE_KEYS as string[]).includes(field)) return null;
  const v = String(value ?? '').trim();
  const k = field as ProfileKey;
  if (NUMERIC.includes(k) && !(parseFloat(v) > 0)) return null;
  if (k === 'deadline' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  if (!v || v.length > 400) return null;
  return [k, v];
}

export function memoryKind(kind: unknown): MemoryKind {
  return MEMORY_KINDS.includes(kind as MemoryKind) ? (kind as MemoryKind) : 'life';
}
