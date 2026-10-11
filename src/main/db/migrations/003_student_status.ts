import { Kysely } from 'kysely';

/** Adds `status` column to students for soft-archive (Phase G). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('students')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('Actif'))
    .execute();
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // SQLite column drop not supported in our target — intentional no-op.
}
