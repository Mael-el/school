// Loads a school profile JSON and applies it to the local SQLite database.
//
// Usage:
//   npx tsx scripts/seed-profile.ts <profile-id> [--reset] [db-path]
//   npm run seed:profile -- emergence --reset
//   npm run seed:profile -- demo --reset
//
// Profiles live in app/profiles/*.json (template, demo, emergence, …).
import fs from 'node:fs';
import path from 'node:path';
import { createDatabase } from '../src/main/db/connection';
import { applySchoolProfile } from './lib/apply-profile';
import { defaultDbPath } from './lib/db-path';
import type { SchoolProfile } from './lib/profile-types';

function listProfiles(): string[] {
  const dir = path.join(__dirname, '../profiles');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.basename(f, '.json'));
}

function loadProfile(profileId: string): SchoolProfile {
  const filePath = path.join(__dirname, '../profiles', `${profileId}.json`);
  if (!fs.existsSync(filePath)) {
    const available = listProfiles().join(', ');
    throw new Error(
      `Profil inconnu : "${profileId}". Profils disponibles : ${available}`,
    );
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as SchoolProfile;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const positional = args.filter((a) => !a.startsWith('--'));
  const profileId = positional[0];
  if (!profileId) {
    console.error(
      'Usage: seed-profile.ts <profile-id> [--reset] [db-path]\n' +
        `Profils : ${listProfiles().join(', ')}`,
    );
    process.exitCode = 1;
    return;
  }

  const dbPath = path.resolve(positional[1] ?? defaultDbPath());
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const profile = loadProfile(profileId);

  console.log(
    `Applying profile "${profile.label}" (${profile.id}) → ${dbPath}` +
      (reset ? ' [--reset]' : ''),
  );

  const { db, sqlite } = await createDatabase(dbPath);
  try {
    const result = await applySchoolProfile(db, profile, { reset });
    console.log(
      `Done: ${result.settingCount} settings, ${result.classCount} classes, ` +
        `${result.studentCount} students, ${result.enrollmentCount} enrollments, ` +
        `${result.paymentCount} payments, ${result.staffCount} staff, ` +
        `${result.staffPaymentCount} salaries, ${result.expenseCount} expenses.`,
    );
    if (profile.demo) {
      console.log('Rechargez la fenêtre de l’application (Cmd/Ctrl+R).');
    }
  } finally {
    sqlite.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
