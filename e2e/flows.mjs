import { tap, type, text, shot, sleep, verifyEmail, log } from './lib.mjs';

/** Wait until the page shows `s` (a string or RegExp). */
export async function see(page, s, timeout = 20000) {
  const t0 = Date.now();
  for (;;) {
    const t = await text(page);
    if (typeof s === 'string' ? t.includes(s) : s.test(t)) return t;
    if (Date.now() - t0 > timeout) throw new Error(`timed out waiting for ${s}; page: ${t.slice(0, 400).replace(/\n/g, ' | ')}`);
    await sleep(300);
  }
}

export async function register(page, u) {
  await page.goto('http://localhost:8082/');
  await see(page, 'Create account');
  await tap(page, 'Create account');
  await type(page, 'Email', u.email);
  await type(page, 'Password · 6+ characters', u.password);
  await shot(page, '01-signup');
  await tap(page, 'Create my account');
  await see(page, 'Confirm your email');
  await shot(page, '02-verify');
  log(u.name, 'verify email ->', await verifyEmail(u.email));
  // The screen checks by itself every 4 s.
  await see(page, /Begin chapter 1/, 40000);
  await shot(page, '03-cover');
}

/** Press and hold the seal for `ms`. */
async function hold(page, ms) {
  const label = page.getByText('HOLD TO SEAL', { exact: true });
  const box = await label.boundingBox();
  const x = box.x + box.width / 2, y = box.y - 70;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
}

/** Drag a ruler (found by its label) until its value is `target`, finishing with − / +. */
async function scrubTo(page, label, target, step) {
  const read = async () => {
    const t = await text(page);
    const i = t.indexOf(label);
    const m = t.slice(i + label.length, i + label.length + 40).match(/(\d+(?:\.\d+)?)/);
    return parseFloat(m[1]);
  };
  const lab = page.getByText(label, { exact: true });
  for (let i = 0; i < 12; i++) {
    const v = await read();
    const diff = target - v;
    if (Math.abs(diff) < step / 2) return;
    if (Math.abs(diff) <= step * 6) {
      const sign = diff > 0 ? '+' : '−';
      const box = await lab.boundingBox();
      // − and + sit on the label's row, to the right.
      const row = page.locator('div', { has: lab }).filter({ hasText: sign }).last();
      for (let k = 0; k < Math.round(Math.abs(diff) / step); k++) await row.getByText(sign, { exact: true }).click();
      continue;
    }
    const box = await lab.boundingBox();
    const y = box.y + 40, x0 = 195;
    const dx = Math.max(-300, Math.min(300, -(diff / step) * 8));
    await page.mouse.move(x0, y);
    await page.mouse.down();
    for (let k = 1; k <= 10; k++) await page.mouse.move(x0 + (dx * k) / 10, y);
    await page.mouse.up();
    await sleep(150);
  }
  throw new Error(`could not set ${label} to ${target} (now ${await read()})`);
}

const next = async (page, cta, nextTitle) => {
  await tap(page, cta);
  if (nextTitle) await see(page, nextTitle, 20000);
  await sleep(1300);
};

export async function onboard(page, u) {
  await tap(page, 'Begin chapter 1');
  await see(page, 'CHAPTER 01');
  await sleep(1200);
  await type(page, 'Your name', u.name);
  await shot(page, '04-name');
  await next(page, 'That’s me', 'CHAPTER 02');
  await tap(page, u.ideal);
  await shot(page, '05-ideal');
  await next(page, 'This is who I become', 'CHAPTER 03');
  await tap(page, u.goal);
  await tap(page, u.weeks);
  await type(page, 'I’m tired of starting over every January.', u.why);
  await shot(page, '06-vow');
  await next(page, 'Lock the vow', 'CHAPTER 04');
  await tap(page, u.sex);
  await scrubTo(page, 'HEIGHT', u.height, 1);
  await scrubTo(page, 'WEIGHT', u.weight, 0.1);
  await shot(page, '07-body');
  await next(page, 'Scan complete', 'CHAPTER 05');
  await shot(page, '08-target');
  await next(page, 'Set the target', 'CHAPTER 06');
  await tap(page, u.exp);
  for (const [label, taps] of Object.entries(u.bests ?? {})) {
    const tile = page.locator('div').filter({ has: page.getByText(label, { exact: true }) }).filter({ hasText: '+' }).last();
    for (let i = 0; i < taps; i++) await tile.getByText('+', { exact: true }).click();
  }
  await shot(page, '09-power');
  u.powerText = (await text(page)).match(/CURRENT BESTS[\s\S]{0,200}/)?.[0];
  await next(page, 'Log my numbers', 'CHAPTER 07');
  await tap(page, String(u.sessions));
  await tap(page, u.time);
  await shot(page, '10-train');
  await next(page, 'Confirm the split', 'CHAPTER 08');
  await tap(page, u.job);
  await shot(page, '11-life');
  await next(page, 'That’s my day', 'CHAPTER 09');
  await tap(page, u.diet);
  await shot(page, '12-kitchen');
  await next(page, 'Run my numbers', 'CHAPTER 10');
  await sleep(2200);
  await shot(page, '13-fuel');
  u.fuelText = (await text(page)).match(/DAILY FUEL[\s\S]{0,200}/)?.[0];
  await next(page, 'Accept the fuel', 'CHAPTER 11');
  for (const q of u.quit) await tap(page, q);
  await type(page, 'Night shifts on Thursdays', u.note);
  await shot(page, '14-weak');
  await next(page, 'Remember this', 'CHAPTER 12');
  await tap(page, u.tone);
  await shot(page, '15-tone');
  await next(page, 'That’s how you talk to me', 'CHAPTER 13');
  await tap(page, u.partner);
  await sleep(2500);
  await shot(page, '16-partner');
  u.partnerText = (await text(page)).match(/SAYS[\s\S]{0,220}/)?.[0];
  await next(page, 'You’re in my corner', 'CHAPTER 14');
  await tap(page, u.world);
  await shot(page, '17-world');
  await next(page, 'Wear it', 'CHAPTER 15');
  await shot(page, '18-link');
  await next(page, 'Connect', 'CHAPTER 16');
  await shot(page, '19-pact');
  u.pactText = (await text(page)).match(/I,[\s\S]{0,500}/)?.[0];
  await hold(page, 2300);
  await see(page, 'Bond established.', 15000);
  await sleep(1500);
  await shot(page, '20-bond');
  await tap(page, 'Enter REI');
  await sleep(4000);
  await shot(page, '21-today');
}
