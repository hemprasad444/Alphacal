// One-off: adds vitamin and mineral estimates to every dish in src/food/dishes.ts, extending its
// nutrient column from [fibre, sugar, sat fat, sodium] to the full nutrients.ts order.
//   OPENROUTER_API_KEY=... npx tsx scripts/estimate-dish-micros.mts
import { readFileSync, writeFileSync } from 'node:fs';
import { DISHES } from '../src/food/dishes';

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) throw new Error('Set OPENROUTER_API_KEY');
const file = new URL('../src/food/dishes.ts', import.meta.url);
const FIELDS = 'potassium mg, calcium mg, iron mg, magnesium mg, zinc mg, vitamin A µg RAE, vitamin C mg, vitamin D µg, vitamin E mg, thiamine mg, riboflavin mg, niacin mg, vitamin B6 mg, folate µg';
const out: Record<string, number[]> = {};

for (let i = 0; i < DISHES.length; i += 40) {
  const batch = DISHES.slice(i, i + 40).map(([id, name, , units, kcal, p, c, f]) => ({ id, name, portion: `${units[0][0]} (${units[0][1]} g)`, kcal, protein: p, carbs: c, fat: f }));
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-5.5',
        temperature: 0,
        max_tokens: 12000,
        messages: [
          { role: 'system', content: 'You are a nutritionist estimating Indian and everyday dishes as typically cooked at home or in an Indian restaurant, using Indian Food Composition Tables 2017 and USDA values for their ingredients. Answer with JSON only.' },
          { role: 'user', content: `For each dish, estimate for exactly the given portion: ${FIELDS}. Reply as one JSON object mapping id to an array of those 14 numbers in that order. Realistic values, no nulls (use 0 when truly none).\n\n${JSON.stringify(batch)}` },
        ],
      }),
    });
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = (j.choices?.[0]?.message?.content ?? '').trim();
    try {
      Object.assign(out, JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Record<string, number[]>);
      break;
    } catch {
      console.log(`retry batch ${i}`);
    }
  }
  console.log(`${Math.min(i + 40, DISHES.length)} / ${DISHES.length}`);
}

let src = readFileSync(file, 'utf8');
let n = 0;
src = src.replace(/^(\s*\['([^']+)', .*), \[([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\]\],$/gm, (line, head, id, a, b, c, d) => {
  const v = out[id];
  if (!v || v.length !== 14 || v.some(x => typeof x !== 'number' || !(x >= 0))) return line;
  n++;
  const r = (x: number) => +(x >= 100 ? Math.round(x) : +x.toPrecision(3));
  return `${head}, [${[a, b, c, d].join(', ')}, ${v.map(r).join(', ')}]],`;
});
src = src.replace('// [id, name, other names, units [name, grams][], kcal, protein, carbs, fat, [fibre g, sugar g, sat fat g, sodium mg]?]\n// for the FIRST unit. The last four are model estimates (scripts/estimate-dish-nutrients.mts).',
  '// [id, name, other names, units [name, grams][], kcal, protein, carbs, fat, nutrients?] for the FIRST unit.\n// Nutrients follow nutrients.ts order (fibre, sugar, sat fat, sodium, minerals, vitamins) and are model\n// estimates (scripts/estimate-dish-nutrients.mts, scripts/estimate-dish-micros.mts).');
writeFileSync(file, src);
console.log(`added vitamins and minerals to ${n} of ${DISHES.length} dishes`);
