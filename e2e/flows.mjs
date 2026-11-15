import { tap, type, text, shot, sleep, verifyEmail, log } from './lib.mjs';

/** Wait until the page shows `s` (a RegExp, or a string in any case: headings and buttons are drawn in capitals). */
export async function see(page, s, timeout = 20000) {
  const t0 = Date.now();
  for (;;) {
    const t = await text(page);
    if (typeof s === 'string' ? t.toLowerCase().includes(s.toLowerCase()) : s.test(t)) return t;
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
  await see(page, 'Start round 1', 40000);
  await shot(page, '03-cover');
}

/** Press and hold the signature slab itself for `ms` (it signs after 1.6 s). */
async function hold(page, ms) {
  // The slab is a button named "Sign the contract"; its words are "HOLD TO SIGN".
  const button = page.getByRole('button', { name: 'Sign the contract' });
  const slab = (await button.count()) ? button.first() : page.getByText('HOLD TO SIGN', { exact: true }).first();
  await slab.scrollIntoViewIfNeeded();
  const box = await slab.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
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

/** Tap the round's button, wait for the next round's stamp ("ROUND 05") and let its card wipe finish. */
const next = async (page, cta, round) => {
  await tap(page, cta);
  if (round) await see(page, `ROUND ${String(round).padStart(2, '0')}`, 20000);
  await sleep(1300);
};

/**
 * The training camp, in the order of STEPS in packages/shared/src/onboarding.ts:
 * name, fighter type, goal, weigh-in, fight weight, training camp, kitchen, corner (voice and world),
 * daily life, fuel, fight record, weak points, corner talk, the pact (hold to sign), the walkout.
 * Button words are the `cta` of each step there; the screens are in app/src/app/onboarding.tsx.
 */
export async function onboard(page, u) {
  await tap(page, 'Start round 1');
  await see(page, 'ROUND 01');
  await sleep(1200);
  // 1 · Ring name
  await type(page, 'Your name', u.name);
  await shot(page, '04-name');
  await next(page, 'That’s me', 2);
  // 2 · Fighter type
  await tap(page, u.ideal);
  await shot(page, '05-ideal');
  await next(page, 'This is who I become', 3);
  // 3 · The goal
  await tap(page, u.goal);
  await tap(page, u.weeks);
  await type(page, 'I’m tired of starting over every January.', u.why);
  await shot(page, '06-goal');
  await next(page, 'Lock the goal', 4);
  // 4 · Weigh-in
  await tap(page, u.sex);
  await scrubTo(page, 'WEIGHT', u.weight, 0.1);
  await scrubTo(page, 'HEIGHT', u.height, 1);
  await shot(page, '07-body');
  await next(page, 'Weigh-in done', 5);
  // 5 · Fight weight
  await shot(page, '08-target');
  await next(page, 'Set the target', 6);
  // 6 · Training camp
  await tap(page, String(u.sessions));
  await tap(page, u.time);
  await tap(page, u.exp);
  await shot(page, '09-train');
  await next(page, 'Confirm the camp', 7);
  // 7 · Kitchen
  await tap(page, u.diet);
  await shot(page, '10-kitchen');
  await next(page, 'That’s how I eat', 8);
  // 8 · Your corner: the voice, then the world it wears (picking a voice already suggests its world)
  await tap(page, u.partner);
  await sleep(2500);
  u.partnerText = (await text(page)).match(/SAYS[\s\S]{0,220}/)?.[0];
  if (u.world) await tap(page, u.world);
  await shot(page, '11-corner');
  await next(page, 'You’re in my corner', 9);
  // 9 · Daily life
  await tap(page, u.job);
  await shot(page, '12-life');
  await next(page, 'Run my numbers', 10);
  // 10 · Fuel
  await sleep(2200);
  await shot(page, '13-fuel');
  u.fuelText = (await text(page)).match(/DAILY FUEL[\s\S]{0,200}/)?.[0];
  await next(page, 'Accept the fuel', 11);
  // 11 · Fight record: a tile's heading is "BENCH · KG" or "5K RUN"; its first + sets the typical value
  for (const [name, taps] of Object.entries(u.bests ?? {})) {
    const heading = page.getByText(new RegExp(`^\\s*${name}(\\s·|\\s*$)`));
    const tile = page.locator('div').filter({ has: heading }).filter({ hasText: '+' }).last();
    for (let i = 0; i < taps; i++) await tile.getByText('+', { exact: true }).click();
  }
  await shot(page, '14-record');
  u.powerText = (await text(page)).match(/CURRENT BESTS[\s\S]{0,200}/)?.[0];
  await next(page, 'Log my numbers', 12);
  // 12 · Weak points
  for (const q of u.quit) await tap(page, q);
  await type(page, 'Night shifts on Thursdays', u.note);
  await shot(page, '15-weak');
  await next(page, 'Remember this', 13);
  // 13 · Corner talk
  await tap(page, u.tone);
  await shot(page, '16-tone');
  await next(page, 'That’s how you talk to me', 14);
  // 14 · The pact
  await shot(page, '17-pact');
  u.pactText = (await text(page)).match(/I,[\s\S]{0,500}/)?.[0];
  await hold(page, 2300);
  // The walkout
  await see(page, 'THE RING IS YOURS.', 15000);
  await sleep(1500);
  await shot(page, '18-walkout');
  await tap(page, 'Walk out');
  await sleep(4000);
  await shot(page, '19-today');
}
