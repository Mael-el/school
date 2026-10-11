// Reads/writes the `settings` key-value table (see docs/electron-app-plan.md
// section 4/8: school info + configurable options, no redeploy needed).
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema-types';

export class SettingsService {
  constructor(private readonly db: Kysely<Database>) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db
      .selectFrom('settings')
      .select('value')
      .where('key', '=', key)
      .executeTakeFirst();
    return row?.value ?? null;
  }

  async getAll(): Promise<Record<string, string | null>> {
    const rows = await this.db.selectFrom('settings').selectAll().execute();
    const result: Record<string, string | null> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async set(key: string, value: string | null): Promise<void> {
    await this.db
      .insertInto('settings')
      .values({ key, value })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value }))
      .execute();
  }

  async setMany(entries: Record<string, string | null>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(key, value);
    }
  }

  /** Convenience accessor: the school year currently used for new
   * enrollments/payments (`settings.current_school_year`). */
  async getCurrentSchoolYear(): Promise<string> {
    const value = await this.get('current_school_year');
    if (!value) {
      throw new Error("Le réglage 'current_school_year' n'est pas configuré.");
    }
    return value;
  }
}
