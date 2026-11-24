const path = require('node:path');
const Database = require('better-sqlite3');
const { applicationDefault, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const databasePath = process.env.DATABASE_URL
  ? path.resolve(__dirname, '..', process.env.DATABASE_URL)
  : path.resolve(__dirname, '..', 'data', 'scheduler.db');
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

if (!projectId) {
  console.error('Set GOOGLE_CLOUD_PROJECT to the Firebase project ID before running this migration.');
  process.exit(1);
}

const source = new Database(databasePath, { readonly: true });
initializeApp({ credential: applicationDefault(), projectId });
const firestore = getFirestore();

async function writeRows(collectionName, rows, documentIdField) {
  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += 400) {
    const chunk = rows.slice(offset, offset + 400);
    const refs = chunk.map((row) =>
      firestore.collection(collectionName).doc(String(row[documentIdField])),
    );
    const existing = await firestore.getAll(...refs);
    const batch = firestore.batch();
    for (let index = 0; index < chunk.length; index += 1) {
      if (existing[index].exists) continue;
      const row = { ...chunk[index] };
      if (
        collectionName === 'emails' &&
        (row.status === 'scheduled' || row.status === 'rescheduled')
      ) {
        row.task_enqueued = false;
        row.task_enqueue_claim_until = 0;
      }
      batch.create(refs[index], row);
      inserted += 1;
    }
    await batch.commit();
  }
  return inserted;
}

async function main() {
  const emails = source.prepare('SELECT * FROM emails').all();
  const senders = source.prepare('SELECT * FROM senders').all();
  const slackConfigs = source.prepare('SELECT * FROM slack_config').all();

  const importedEmails = await writeRows('emails', emails, 'id');
  const importedSenders = await writeRows('senders', senders, 'id');
  const importedSlackConfigs = await writeRows(
    'settings',
    slackConfigs.map((row) => ({ ...row, id: 'slack' })),
    'id',
  );

  console.log(
    `Migration complete. Added ${importedEmails} email records, ${importedSenders} senders, and ${importedSlackConfigs} Slack setting(s).`,
  );
}

main()
  .catch((error) => {
    console.error('SQLite to Firestore migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => source.close());
