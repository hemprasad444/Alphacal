import type Anthropic from '@anthropic-ai/sdk';
import { PROFILE_KEYS, type MealEstimate, type ProfileKey } from '@rei/shared';

type Tool = Anthropic.Beta.Messages.BetaTool;

const mealProps = {
  name: { type: 'string', description: 'Short name for the meal, e.g. "Chicken rice bowl"' },
  kcal: { type: 'integer', description: 'Total calories' },
  p: { type: 'integer', description: 'Protein, grams' },
  c: { type: 'integer', description: 'Carbohydrates, grams' },
  f: { type: 'integer', description: 'Fat, grams' },
} as const;

/** Chat: REI writes its reply as text, then logs the meal. */
export const logMealTool: Tool = {
  name: 'log_meal',
  description: 'Log a meal the user says they ate, with realistic macro estimates. Call it after writing your reply.',
  strict: true,
  eager_input_streaming: true,
  input_schema: { type: 'object', properties: mealProps, required: ['name', 'kcal', 'p', 'c', 'f'], additionalProperties: false },
};

/** Fuel screen: the estimate and REI's verdict come back together in one forced call. */
export const logMealWithVerdictTool: Tool = {
  name: 'log_meal',
  description: 'Log the meal with realistic macro estimates and REI’s one or two sentence verdict on how it fits the rest of today’s budget.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: { ...mealProps, verdict: { type: 'string', description: 'REI’s reaction, in REI’s voice, using the numbers left after this meal' } },
    required: ['name', 'kcal', 'p', 'c', 'f', 'verdict'],
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
