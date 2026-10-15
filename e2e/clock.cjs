// Shifts Date for Firebase function worker processes only, by the offset (ms) in REI_CLOCK_FILE.
// Lets an end-to-end test walk through several days while the emulators' own clocks stay real.
const isWorker = process.argv.join(' ').includes('functionsEmulatorRuntime') || process.env.FUNCTIONS_EMULATOR === 'true';
if (isWorker && process.env.REI_CLOCK_FILE) {
  const fs = require('fs');
  const RealDate = Date;
  let cache = { at: 0, off: 0 };
  const offset = () => {
    const now = RealDate.now();
    if (now - cache.at > 150) {
      try { cache = { at: now, off: Number(fs.readFileSync(process.env.REI_CLOCK_FILE, 'utf8')) || 0 }; } catch { cache = { at: now, off: 0 }; }
    }
    return cache.off;
  };
  class ShiftedDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(RealDate.now() + offset()); else super(...a); }
    static now() { return RealDate.now() + offset(); }
  }
  globalThis.Date = ShiftedDate;
}
