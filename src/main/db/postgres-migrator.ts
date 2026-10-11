import type { Kysely } from 'kysely';
import { Migrator, type MigrationProvider } from 'kysely/migration';
import * as initialSchema from './postgres-migrations/001_initial_schema';
import * as webAuth from './postgres-migrations/002_web_auth';

const provider: MigrationProvider = {
  async getMigrations() {
    return {
      '001_initial_schema': initialSchema,
      '002_web_auth': webAuth,
    };
  },
};

export async function runPostgresMigrations(
  db: Kysely<unknown>,
): Promise<void> {
  const migrator = new Migrator({ db, provider });
  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === 'Error') {
      console.error(`PostgreSQL migration failed: ${result.migrationName}`);
    }
  }
  if (error) throw error;
}
