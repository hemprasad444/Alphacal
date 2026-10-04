// One-off: estimates fibre, sugar, saturated fat and sodium for each dish in src/food/dishes.ts
// (its first unit, matching the macros already there) and writes them in as a 9th column.
//   OPENROUTER_API_KEY=... npx tsx scripts/estimate-dish-nutrients.mts
import { readFileSync, writeFileSync } from 'node:fs';
import { DISHES } from '../src/food/dishes';

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error('Set OPENROUTER_API_KEY');
const file = new URL('../src/food/dishes.ts', import.meta.url);
const out: Record<string, number[]> = {};

for (let i = 0; i < DISHES.length; i += 50) {
  const batch = DISHES.slice(i, i + 50).map(([id, name, , units, kcal, p, c, f]) => ({ id, name, portion: `${units[0][0]} (${units[0][1]} g)`, kcal, protein: p, carbs: c, fat: f }));
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-5.5',
      temperature: 0,
      max_tokens: 6000,
      messages: [
        { role: 'system', content: 'You are a nutritionist estimating Indian and everyday dishes as typically cooked at home or in an Indian restaurant. Answer with JSON only.' },
        { role: 'user', content: `For each dish, estimate for exactly the given portion: dietary fibre (g), total sugars (g), saturated fat (g) and sodium (mg). Stay consistent with the given calories and macros. Reply as one JSON object mapping id to [fibre, sugar, satFat, sodium], numbers only, one decimal for grams, whole mg for sodium.\n\n${JSON.stringify(batch)}` },
      ],
    }),
  });
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = (j.choices?.[0]?.message?.content ?? '').replace(/^```(json)?|```$/g, '').trim();
  const part = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Record<string, number[]>;
  Object.assign(out, part);
  console.log(`${Math.min(i + 50, DISHES.length)} / ${DISHES.length}`);
}

let src = readFileSync(file, 'utf8');
let n = 0;
src = src.replace(/^(\s*\['([^']+)', .*), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?)\],$/gm, (line, head, id, kcal, p, c, f) => {
  const v = out[id];
  if (!v || v.length !== 4 || v.some(x => typeof x !== 'number' || !(x >= 0))) return line;
  n++;
  return `${head}, ${kcal}, ${p}, ${c}, ${f}, [${v.map(x => +(+x).toFixed(1)).join(', ')}]],`;
});
src = src
  .replace('// [id, name, other names, units [name, grams][], kcal, protein, carbs, fat] for the FIRST unit.', '// [id, name, other names, units [name, grams][], kcal, protein, carbs, fat, [fibre g, sugar g, sat fat g, sodium mg]?]\n// for the FIRST unit. The last four are model estimates (scripts/estimate-dish-nutrients.mts).')
  .replace('export const DISHES: [string, string, string, [string, number][], number, number, number, number][] = [', 'export const DISHES: ([string, string, string, [string, number][], number, number, number, number] | [string, string, string, [string, number][], number, number, number, number, number[]])[] = [');
writeFileSync(file, src);
console.log(`wrote nutrients for ${n} of ${DISHES.length} dishes`);
