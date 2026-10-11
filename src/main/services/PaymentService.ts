// Payment capture, receipt numbering (via `counters`, never MAX(receipt_no)),
// and cancellation (payments are never deleted — see docs/electron-app-plan.md
// section 4).
import type { Kysely, Selectable } from 'kysely';
import type { Database, PaymentsTable } from '../db/schema-types';
import { logAudit } from './AuditLog';

export interface CreatePaymentInput {
  enrollment_id: number;
  payment_date: string;
  category_id?: number | null;
  term?: '1er trimestre' | '2e trimestre' | '3e trimestre' | null;
  installment_no?: number | null;
  amount: number;
  payment_mode: string;
  transaction_ref?: string | null;
  cashier_id?: number | null;
  note?: string | null;
}

export class PaymentService {
  constructor(private readonly db: Kysely<Database>) {}

  async getById(id: number) {
    return this.db
      .selectFrom('payments')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async listForEnrollment(enrollmentId: number): Promise<Selectable<PaymentsTable>[]> {
    return this.db
      .selectFrom('payments')
      .selectAll()
      .where('enrollment_id', '=', enrollmentId)
      .orderBy('payment_date')
      .execute() as unknown as Promise<Selectable<PaymentsTable>[]>;
  }

  /**
   * Atomically bumps a named counter and returns its new value. Must be
   * called inside the same transaction as the row that consumes it, so a
   * rollback never "burns" a receipt number.
   */
  private async nextCounterValue(
    trx: Kysely<Database>,
    counterName: string,
  ): Promise<number> {
    await trx
      .insertInto('counters')
      .values({ name: counterName, last_value: 1 })
      .onConflict((oc) =>
        oc
          .column('name')
          .doUpdateSet({ last_value: (eb) => eb('last_value', '+', 1) }),
      )
      .execute();

    const row = await trx
      .selectFrom('counters')
      .select('last_value')
      .where('name', '=', counterName)
      .executeTakeFirstOrThrow();

    return row.last_value;
  }

  async create(
    input: CreatePaymentInput,
    receiptPrefix: string,
  ): Promise<Selectable<PaymentsTable>> {
    return this.db.transaction().execute(async (trx) => {
      const counterValue = await this.nextCounterValue(trx, 'payment_receipt');
      const receiptNo = `${receiptPrefix}-${String(counterValue).padStart(4, '0')}`;

      const result = await trx
        .insertInto('payments')
        .values({
          receipt_no: receiptNo,
          enrollment_id: input.enrollment_id,
          payment_date: input.payment_date,
          category_id: input.category_id ?? null,
          term: input.term ?? null,
          installment_no: input.installment_no ?? null,
          amount: input.amount,
          payment_mode: input.payment_mode,
          transaction_ref: input.transaction_ref ?? null,
          cashier_id: input.cashier_id ?? null,
          note: input.note ?? null,
          status: 'Validé',
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const id = Number(result.id);
      const payment = await trx
        .selectFrom('payments')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      await logAudit(trx, {
        action: 'CREATE',
        entity: 'payments',
        entityId: id,
        after: payment,
      });

      return payment as unknown as Selectable<PaymentsTable>;
    });
  }

  /** Never deletes a payment: marks it 'Annulé' with a reason, per the
   * accounting-integrity rule in docs/electron-app-plan.md section 4. */
  async cancel(id: number, reason: string): Promise<void> {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Paiement introuvable (id=${id})`);
    }
    if (before.status === 'Annulé') {
      throw new Error('Ce paiement est déjà annulé.');
    }

    await this.db
      .updateTable('payments')
      .set({
        status: 'Annulé',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: reason,
      })
      .where('id', '=', id)
      .execute();

    const after = await this.getById(id);
    await logAudit(this.db, {
      action: 'CANCEL',
      entity: 'payments',
      entityId: id,
      before,
      after,
      note: reason,
    });
  }

  /** Permanently removes a payment record (use cancel() to preserve audit trail). */
  async delete(id: number): Promise<void> {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Paiement introuvable (id=${id})`);
    }

    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('audit_log')
        .where('entity', '=', 'payments')
        .where('entity_id', '=', id)
        .execute();
      await trx.deleteFrom('payments').where('id', '=', id).execute();
    });

    await logAudit(this.db, {
      action: 'DELETE',
      entity: 'payments',
      entityId: id,
      before,
    });
  }
}
