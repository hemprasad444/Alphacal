import type Anthropic from '@anthropic-ai/sdk';
import { type AiItem, MEMORY_KINDS, type MemoryKind, PROFILE_KEYS, type MealEstimate, type ProfileKey } from '@rei/shared';

type Tool = Anthropic.Beta.Messages.BetaTool;

const mealProps = {
  name: { type: 'string', description: 'Short name for the meal, e.g. "Chicken rice bowl"' },
  kcal: { type: 'integer', description: 'Total calories' },
  p: { type: 'integer', description: 'Protein, grams' },
  c: { type: 'integer', description: 'Carbohydrates, grams' },
  f: { type: 'integer', description: 'Fat, grams' },
} as const;

/** Each food in the meal: a Food list id when one fits (the server then uses the list's numbers), else REI's estimate. */
const itemsProp = {
  type: 'array',
  description: 'Each food in the meal, in the amount eaten',
  items: {
    type: 'object',
    properties: {
      food_id: { type: 'string', description: 'The id from the Food list, or "none" when it is not on the list' },
      name: { type: 'string', description: 'Short name of this food' },
      qty: { type: 'number', description: 'How many of `unit`, e.g. 2 (rotis) or 150 (g)' },
      unit: { type: 'string', description: 'One of the food’s listed portions, or "g". For foods not on the list: "serving", "katori", "piece" or "g"' },
      kcal: { type: 'integer', description: 'Your estimate for this amount' },
      p: { type: 'integer' },
      c: { type: 'integer' },
      f: { type: 'integer' },
    },
    required: ['food_id', 'name', 'qty', 'unit', 'kcal', 'p', 'c', 'f'],
    additionalProperties: false,
  },
} as const;

/** Chat: REI writes its reply as text, then logs the meal. */
export const logMealTool: Tool = {
  name: 'log_meal',
  description: 'Log a meal the user says they ate, one entry per food. Call it after writing your reply.',
  strict: true,
  eager_input_streaming: true,
  input_schema: { type: 'object', properties: { name: mealProps.name, items: itemsProp }, required: ['name', 'items'], additionalProperties: false },
};

/** Fuel screen: the items and REI's verdict come back together in one forced call. */
export const logMealWithVerdictTool: Tool = {
  name: 'log_meal',
  description: 'Log the meal, one entry per food, with REI’s one or two sentence verdict on how it fits the rest of today’s budget.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: { name: mealProps.name, items: itemsProp, verdict: { type: 'string', description: 'REI’s reaction, in REI’s voice, using the numbers left after this meal' } },
    required: ['name', 'items', 'verdict'],
    additionalProperties: false,
  },
};

export const updateVowTool: Tool = {
  name: 'update_vow',
  description: 'Change the user’s goal, deadline, body stats or daily targets when they explicitly ask. Include only fields that change.',
  strict: true,
  eager_input_streaming: true,
  input_schema: {
    type: 'object',
    properties: {
      changes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', enum: [...PROFILE_KEYS] },
            value: { type: 'string', description: 'New value. Numbers as plain digits; deadline as YYYY-MM-DD.' },
          },
          required: ['field', 'value'],
          additionalProperties: false,
        },
      },
    },
    required: ['changes'],
    additionalProperties: false,
  },
};

/** Deep tier only: queues a rewrite of this week's training, which runs off the request path. */
export const rebuildProgramTool: Tool = {
  name: 'rebuild_program',
  description: 'Rewrite this week\u2019s training plan when the user asks for a new or changed plan. Say in your reply that the new week is coming.',
  strict: true,
  eager_input_streaming: true,
  input_schema: {
    type: 'object',
    properties: { focus: { type: 'string', description: 'What the user wants changed, in a few words' } },
    required: ['focus'],
    additionalProperties: false,
  },
};

/** REI keeps a lasting fact about the user. */
export const rememberTool: Tool = {
  name: 'remember',
  description: 'Keep lasting facts about the user (diet, allergies, injuries, schedule, equipment, likes and dislikes, life constraints) for all future conversations. Call it after writing your reply.',
  strict: true,
  eager_input_streaming: true,
  input_schema: {
    type: 'object',
    properties: {
      facts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Short third-person note, e.g. "Vegetarian; eats eggs and dairy"' },
            kind: { type: 'string', enum: [...MEMORY_KINDS] },
          },
          required: ['text', 'kind'],
          additionalProperties: false,
        },
      },
    },
    required: ['facts'],
    additionalProperties: false,
  },
};

export const forgetTool: Tool = {
  name: 'forget',
  description: 'Drop remembered facts that the user says are no longer true, by their ids.',
  strict: true,
  eager_input_streaming: true,
  input_schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'], additionalProperties: false },
};

export function parseRemember(input: unknown): { text: string; kind: MemoryKind }[] {
  const facts = (input as { facts?: unknown } | null)?.facts;
  if (!Array.isArray(facts)) return [];
  return facts
    .slice(0, 5)
    .map(f => f as { text?: unknown; kind?: unknown })
    .filter(f => typeof f?.text === 'string' && f.text.trim().length > 2)
    .map(f => ({ text: String(f.text).trim().slice(0, 160), kind: MEMORY_KINDS.includes(f.kind as MemoryKind) ? (f.kind as MemoryKind) : 'life' }));
}

export function parseForget(input: unknown): string[] {
  const ids = (input as { ids?: unknown } | null)?.ids;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string').slice(0, 10) : [];
}

const int = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : null);

/**
 * Tool inputs are validated here: with eager input streaming the API no longer
 * checks them, and a truncated input can still parse.
 */
export function parseMeal(input: unknown): (MealEstimate & { name: string; verdict?: string }) | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const kcal = int(o.kcal, 6000), p = int(o.p, 600), c = int(o.c, 1000), f = int(o.f, 400);
  if (typeof o.name !== 'string' || !o.name.trim() || kcal === null || p === null || c === null || f === null) return null;
  return { name: o.name.trim().slice(0, 60), kcal, p, c, f, ...(typeof o.verdict === 'string' ? { verdict: o.verdict.trim().slice(0, 600) } : {}) };
}

/** log_meal input → meal name, items and optional verdict; null when unusable. */
export function parseMealItems(input: unknown): { name: string; items: AiItem[]; verdict?: string } | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  if (typeof o.name !== 'string' || !o.name.trim() || !Array.isArray(o.items) || !o.items.length) return null;
  const items: AiItem[] = [];
  for (const raw of o.items.slice(0, 20)) {
    const i = (raw ?? {}) as Record<string, unknown>;
    const kcal = int(i.kcal, 6000), p = int(i.p, 600), c = int(i.c, 1000), f = int(i.f, 400);
    const qty = typeof i.qty === 'number' && Number.isFinite(i.qty) && i.qty > 0 && i.qty <= 5000 ? i.qty : null;
    if (typeof i.name !== 'string' || !i.name.trim() || qty === null || kcal === null || p === null || c === null || f === null) continue;
    items.push({
      food_id: typeof i.food_id === 'string' ? i.food_id.slice(0, 60) : 'none',
      name: i.name.trim().slice(0, 60),
      qty,
      unit: typeof i.unit === 'string' ? i.unit.trim().slice(0, 24) : '',
      kcal, p, c, f,
    });
  }
  if (!items.length) return null;
  return { name: o.name.trim().slice(0, 60), items, ...(typeof o.verdict === 'string' ? { verdict: o.verdict.trim().slice(0, 600) } : {}) };
}

const NUMERIC: ProfileKey[] = ['weight', 'targetWeight', 'bf', 'targetBf', 'kcal', 'protein', 'carbs', 'fat', 'steps', 'sleep', 'sessions'];

export function parseVow(input: unknown): Partial<Record<ProfileKey, string>> | null {
  const changes = (input as { changes?: unknown } | null)?.changes;
  if (!Array.isArray(changes)) return null;
  const out: Partial<Record<ProfileKey, string>> = {};
  for (const ch of changes) {
    const field = (ch as { field?: unknown })?.field, value = (ch as { value?: unknown })?.value;
    if (typeof field !== 'string' || typeof value !== 'string' || !(PROFILE_KEYS as string[]).includes(field)) continue;
    const k = field as ProfileKey, v = value.trim();
    if (NUMERIC.includes(k) && !(parseFloat(v) > 0)) continue;
    if (k === 'deadline' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
    if (k === 'goal' && (!v || v.length > 400)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}
