// Runs Kysely migrations against a given database instance. Uses an
// in-memory migration provider (no filesystem globbing needed since we
// only have one migration file today; add more `NNN_description.ts`
// modules to this map as the schema evolves).
import type { Kysely } from 'kysely';
// eslint-disable-next-line import/no-unresolved -- eslint-plugin-import's
// resolver doesn't yet understand kysely's "./migration" subpath export.
import { Migrator, type MigrationProvider } from 'kysely/migration';
import * as initialSchema from './migrations/001_initial_schema';
import * as bilingualClassLevels from './migrations/002_bilingual_class_levels';
import * as studentStatus from './migrations/003_student_status';
import * as classFeesBySection from './migrations/004_class_fees_by_section';
import * as cancelReasonsActiveBalances from './migrations/005_cancel_reasons_active_balances';
import * as webAuth from './migrations/006_web_auth';

const migrations = {
  '001_initial_schema': initialSchema,
  '002_bilingual_class_levels': bilingualClassLevels,
  '003_student_status': studentStatus,
  '004_class_fees_by_section': classFeesBySection,
  '005_cancel_reasons_active_balances': cancelReasonsActiveBalances,
  '006_web_auth': webAuth,
};

const provider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};

export async function runMigrations(db: Kysely<unknown>): Promise<void> {
  const migrator = new Migrator({ db, provider });
  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === 'Error') {
      console.error(`Migration failed: ${result.migrationName}`);
    }
  }

  if (error) {
    throw error;
  }
}
