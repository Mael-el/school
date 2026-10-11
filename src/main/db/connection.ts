// Database connection factory. Desktop and tests use SQLite; hosted web
// deployments may select PostgreSQL with DATABASE_URL.
import type Database from 'better-sqlite3';
import { Kysely, PostgresDialect, SqliteDialect, sql } from 'kysely';
import { Pool } from 'pg';
import type { Database as Schema } from './schema-types';
import { runMigrations } from './migrator';
import { runPostgresMigrations } from './postgres-migrator';
import {
  TEMPLATE_CASHIERS,
  TEMPLATE_DEFAULT_SETTINGS,
  TEMPLATE_PAYMENT_CATEGORIES,
} from '../../../shared/school-defaults';
import { SettingsService } from '../services/SettingsService';

export interface AppDatabase {
  sqlite: Database.Database | null;
  db: Kysely<Schema>;
  close(): Promise<void>;
}

/**
 * Opens (or creates) a SQLite database at `filePath`, enables WAL mode +
 * foreign key enforcement, wraps it in a typed Kysely instance, and runs
 * any pending migrations.
 *
 * @param filePath Path to the .sqlite file, or ':memory:' for an ephemeral
 *   in-memory database (used by unit tests).
 */
export async function createDatabase(filePath: string): Promise<AppDatabase> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.PGSSLMODE === 'disable'
          ? false
          : { rejectUnauthorized: false },
      max: Number(process.env.PGPOOL_MAX ?? 5),
    });
    const db = new Kysely<Schema>({
      dialect: new PostgresDialect({ pool }),
    });

    try {
      await runPostgresMigrations(db as Kysely<unknown>);
      await ensureDefaultSettings(db);
    } catch (error) {
      await db.destroy();
      throw error;
    }

    return { sqlite: null, db, close: () => db.destroy() };
  }

  const { default: SqliteDatabase } = await import('better-sqlite3');
  const sqlite = new SqliteDatabase(filePath);

  // WAL mode tolerates power loss / crashes better than the default
  // rollback journal, and allows concurrent readers while writing.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = new Kysely<Schema>({
    dialect: new SqliteDialect({ database: sqlite }),
  });

  await runMigrations(db as Kysely<unknown>);
  await ensureDefaultSettings(db);

  return {
    sqlite,
    db,
    close: async () => {
      await db.destroy();
      sqlite.close();
    },
  };
}

/** Seeds generic school-agnostic defaults when the database is first created. */
export async function ensureDefaultSettings(db: Kysely<Schema>): Promise<void> {
  const row = await db
    .selectFrom('settings')
    .select(sql<number>`count(*)`.as('count'))
    .executeTakeFirst();
  if (Number(row?.count ?? 0) > 0) return;

  const settings = new SettingsService(db);
  await settings.setMany(TEMPLATE_DEFAULT_SETTINGS);

  for (const name of TEMPLATE_PAYMENT_CATEGORIES) {
    await db
      .insertInto('payment_categories')
      .values({ name, description: null })
      .execute();
  }
  for (const name of TEMPLATE_CASHIERS) {
    await db.insertInto('cashiers').values({ name }).execute();
  }
}
