// Expense capture, reference numbering (via `counters`, same
// never-derive-from-MAX pattern as PaymentService), and cancellation
// (expenses are never deleted — see docs/electron-app-plan.md section 4).
import type { Kysely, Selectable } from 'kysely';
import type { Database, ExpensesTable } from '../db/schema-types';
import { logAudit } from './AuditLog';

export interface CreateExpenseInput {
  expense_date: string;
  category_id?: number | null;
  description: string;
  amount: number;
  payment_mode: string;
  supplier_name?: string | null;
  receipt_ref?: string | null;
  approved_by?: string | null;
  note?: string | null;
}

export interface ExpenseFilters {
  from?: string;
  to?: string;
  categoryId?: number;
  paymentMode?: string;
}

export class ExpenseService {
  constructor(private readonly db: Kysely<Database>) {}

  async getById(id: number) {
    return this.db
      .selectFrom('expenses')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async list(filters: ExpenseFilters = {}): Promise<Selectable<ExpensesTable>[]> {
    let query = this.db.selectFrom('expenses').selectAll();
    if (filters.from) query = query.where('expense_date', '>=', filters.from);
    if (filters.to) query = query.where('expense_date', '<=', filters.to);
    if (filters.categoryId !== undefined)
      query = query.where('category_id', '=', filters.categoryId);
    if (filters.paymentMode)
      query = query.where('payment_mode', '=', filters.paymentMode);
    return query
      .orderBy('expense_date', 'desc')
      .execute() as unknown as Promise<Selectable<ExpensesTable>[]>;
  }

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
    input: CreateExpenseInput,
    referencePrefix: string,
  ): Promise<Selectable<ExpensesTable>> {
    return this.db.transaction().execute(async (trx) => {
      const counterValue = await this.nextCounterValue(
        trx,
        'expense_reference',
      );
      const referenceNo = `${referencePrefix}-${String(counterValue).padStart(4, '0')}`;

      const result = await trx
        .insertInto('expenses')
        .values({
          reference_no: referenceNo,
          expense_date: input.expense_date,
          category_id: input.category_id ?? null,
          description: input.description,
          amount: input.amount,
          payment_mode: input.payment_mode,
          supplier_name: input.supplier_name ?? null,
          receipt_ref: input.receipt_ref ?? null,
          approved_by: input.approved_by ?? null,
          note: input.note ?? null,
          status: 'Validé',
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const id = Number(result.id);
      const expense = await trx
        .selectFrom('expenses')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      await logAudit(trx, {
        action: 'CREATE',
        entity: 'expenses',
        entityId: id,
        after: expense,
      });

      return expense as unknown as Selectable<ExpensesTable>;
    });
  }

  /** Corrects a validated expense in place (date, amount, description…).
   * Cancelled expenses are frozen: cancel + re-create instead. */
  async update(
    id: number,
    input: Partial<CreateExpenseInput>,
  ): Promise<Selectable<ExpensesTable>> {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Dépense introuvable (id=${id})`);
    }
    if (before.status === 'Annulé') {
      throw new Error('Impossible de modifier une dépense annulée.');
    }

    await this.db
      .updateTable('expenses')
      .set({ ...input })
      .where('id', '=', id)
      .execute();

    const after = await this.getById(id);
    await logAudit(this.db, {
      action: 'UPDATE',
      entity: 'expenses',
      entityId: id,
      before,
      after,
    });

    return after as unknown as Selectable<ExpensesTable>;
  }

  /** Never deletes an expense: marks it 'Annulé' with a reason, mirroring
   * PaymentService.cancel(). */
  async cancel(id: number, reason: string): Promise<void> {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Dépense introuvable (id=${id})`);
    }
    if (before.status === 'Annulé') {
      throw new Error('Cette dépense est déjà annulée.');
    }

    await this.db
      .updateTable('expenses')
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
      entity: 'expenses',
      entityId: id,
      before,
      after,
      note: reason,
    });
  }

  /** Permanently removes an expense record. */
  async delete(id: number): Promise<void> {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Dépense introuvable (id=${id})`);
    }

    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('audit_log')
        .where('entity', '=', 'expenses')
        .where('entity_id', '=', id)
        .execute();
      await trx.deleteFrom('expenses').where('id', '=', id).execute();
    });

    await logAudit(this.db, {
      action: 'DELETE',
      entity: 'expenses',
      entityId: id,
      before,
    });
  }

  /** Totals per category (only 'Validé' expenses) — used for the "Dépenses"
   * screen's category breakdown chart. */
  async totalsByCategory(
    filters: ExpenseFilters = {},
  ): Promise<
    { category_id: number | null; category_name: string; total: number }[]
  > {
    let query = this.db
      .selectFrom('expenses')
      .leftJoin(
        'expense_categories',
        'expense_categories.id',
        'expenses.category_id',
      )
      .select([
        'expenses.category_id as category_id',
        (eb) =>
          eb.fn
            .coalesce('expense_categories.name', eb.val('Sans catégorie'))
            .as('category_name'),
        (eb) => eb.fn.sum<number>('expenses.amount').as('total'),
      ])
      .where('expenses.status', '=', 'Validé');
    if (filters.from)
      query = query.where('expenses.expense_date', '>=', filters.from);
    if (filters.to)
      query = query.where('expenses.expense_date', '<=', filters.to);
    if (filters.categoryId !== undefined)
      query = query.where('expenses.category_id', '=', filters.categoryId);
    return query
      .groupBy(['expenses.category_id', 'expense_categories.name'])
      .execute() as unknown as Promise<
      { category_id: number | null; category_name: string; total: number }[]
    >;
  }
}
