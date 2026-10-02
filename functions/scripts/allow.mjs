// Invite a tester: node scripts/allow.mjs someone@example.com [more@example.com ...]
// Production: run `gcloud auth application-default login` first and pass --project <id>.
// Emulator: run with FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 and --project demo-rei.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const pi = args.indexOf('--project');
const projectId = pi >= 0 ? args.splice(pi, 2)[1] : process.env.GCLOUD_PROJECT;
const emails = args.map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
if (!emails.length) {
  console.error('Usage: node scripts/allow.mjs [--project <id>] email [email ...]');
  process.exit(1);
}
initializeApp(projectId ? { projectId } : undefined);
const db = getFirestore();
for (const email of emails) {
  await db.doc(`allowlist/${email}`).set({ addedAt: FieldValue.serverTimestamp() });
  console.log(`allowed ${email}`);
}
