// End-to-end harness for REI: drives the web build against the Firebase emulators.
import { chromium } from 'playwright';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
/** This folder, and the repo around it. */
export const E2E = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(E2E, '..');
const req = createRequire(path.join(REPO, 'functions/package.json'));
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
const { initializeApp, getApps } = req('firebase-admin/app');
const { getFirestore } = req('firebase-admin/firestore');
const { getAuth } = req('firebase-admin/auth');
if (!getApps().length) initializeApp({ projectId: 'demo-rei' });
export const db = getFirestore();
export const adminAuth = getAuth();

/** Screenshots, the run log and the shared clock file (git-ignored). */
export const DIR = path.join(E2E, '.out');
fs.mkdirSync(DIR, { recursive: true });
export const SHOTS = `${DIR}/shots`;
fs.mkdirSync(SHOTS, { recursive: true });
export const APP = 'http://localhost:8082';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Tell the server's function workers what time it is (offset from real time, ms). */
export function serverClock(simulated) {
  fs.writeFileSync(`${DIR}/clock-offset`, String(simulated.getTime() - Date.now()));
}

export async function launch() {
  return chromium.launch({ headless: true });
}

/** A phone-sized browser context in India time, with the app's clock at `at`. */
export async function phone(browser, at, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Asia/Kolkata', locale: 'en-IN', permissions: ['microphone'] });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
  page.on('response', async r => {
    if (r.status() >= 400) {
      let body = '';
      try { body = (await r.text()).slice(0, 200); } catch {}
      logs.push(`[http ${r.status()}] ${r.request().method()} ${r.url().slice(0, 160)} ${body}`);
    }
  });
  await page.clock.install({ time: at });
  serverClock(at);
  page.rei = { name, logs };
  return page;
}

/** Move both clocks (browser and server) to `at`. */
export async function setTime(page, at) {
  await page.clock.setSystemTime(at);
  serverClock(at);
}

export async function shot(page, label) {
  const f = `${SHOTS}/${page.rei.name}-${label}.png`;
  await page.screenshot({ path: f });
  return f;
}

/** Click the innermost element whose text is exactly `text`. */
export async function tap(page, text, opts = {}) {
  const loc = page.getByText(text, { exact: opts.exact ?? true }).last();
  await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? 15000 });
  await loc.scrollIntoViewIfNeeded();
  await loc.click();
}

export async function type(page, placeholder, value, opts = {}) {
  const loc = page.getByPlaceholder(placeholder).last();
  await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? 15000 });
  await loc.fill(value);
  if (opts.enter) await loc.press('Enter');
}

export const text = page => page.evaluate(() => document.body.innerText);

/** Confirm a test account's email in the Auth emulator, as clicking the email link would. */
export async function verifyEmail(email) {
  const r = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-rei/oobCodes');
  const { oobCodes } = await r.json();
  const code = oobCodes.filter(c => c.email === email && c.requestType === 'VERIFY_EMAIL').pop();
  if (!code) throw new Error(`no verification email for ${email}`);
  const res = await fetch(code.oobLink.replace('127.0.0.1', '127.0.0.1'));
  return res.status;
}

export async function uidOf(email) {
  return (await adminAuth.getUserByEmail(email)).uid;
}

export function log(...a) {
  const line = a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  console.log(line);
  fs.appendFileSync(`${DIR}/run.log`, line + '\n');
}
