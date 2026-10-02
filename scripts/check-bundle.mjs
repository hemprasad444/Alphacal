// Fails when the app's JavaScript bundle grows past its budget, so a heavy import or data
// file can't slip in unnoticed. Measures the web export (close to the iOS bundle's size).
//   node scripts/check-bundle.mjs [budget MB, default 5]
import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const budgetMb = Number(process.argv[2] ?? 5);
const out = mkdtempSync(join(tmpdir(), 'rei-bundle-'));
execSync(`npx expo export --platform web --output-dir ${out}`, { cwd: 'app', stdio: 'inherit', env: { ...process.env, EXPO_OFFLINE: '1' } });
const dir = join(out, '_expo/static/js/web');
const total = readdirSync(dir).filter(f => f.endsWith('.js')).reduce((a, f) => a + statSync(join(dir, f)).size, 0);
const mb = total / 1024 / 1024;
console.log(`JS bundle: ${mb.toFixed(2)} MB (budget ${budgetMb} MB)`);
if (mb > budgetMb) {
  console.error('Bundle over budget. Lazy-load the new code or data, or raise the budget on purpose.');
  process.exit(1);
}
