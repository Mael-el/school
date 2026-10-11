// Small helper to write an audit_log row alongside any sensitive mutation
// (payment cancellation, fee changes, etc.) — see docs/electron-app-plan.md
// section 4 / 7. No "utilisateur" column in v1 (mono-utilisateur app).
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema-types';

export type AuditAction = 'CREATE' | 'UPDATE' | 'CANCEL' | 'DELETE';

export async function logAudit(
  db: Kysely<Database>,
  params: {
    action: AuditAction;
    entity: string;
    entityId: number;
    before?: unknown;
    after?: unknown;
    note?: string;
  },
): Promise<void> {
  await db
    .insertInto('audit_log')
    .values({
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId,
      before_json:
        params.before !== undefined ? JSON.stringify(params.before) : null,
      after_json:
        params.after !== undefined ? JSON.stringify(params.after) : null,
      note: params.note ?? null,
    })
    .execute();
}
