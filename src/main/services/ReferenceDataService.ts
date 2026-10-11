import type { Kysely } from 'kysely';
import type { Database } from '../db/schema-types';

function isUniqueConstraintError(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const message = err instanceof Error ? err.message : String(err);
  return (
    code.includes('SQLITE_CONSTRAINT') ||
    message.includes('UNIQUE constraint failed')
  );
}

function namesMatch(left: string, right: string): boolean {
  return (
    left.trim().toLocaleLowerCase('fr') === right.trim().toLocaleLowerCase('fr')
  );
}

export class ReferenceDataService {
  constructor(private readonly db: Kysely<Database>) {}

  async createPaymentCategory(input: {
    name: string;
    description?: string | null;
  }) {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Le nom de la catégorie est obligatoire.');
    }
    const rows = await this.db
      .selectFrom('payment_categories')
      .select(['id', 'name'])
      .execute();
    if (rows.some((row) => namesMatch(row.name, name))) {
      throw new Error(`La catégorie « ${name} » existe déjà.`);
    }
    try {
      return await this.db
        .insertInto('payment_categories')
        .values({ name, description: input.description ?? null })
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new Error(`La catégorie « ${name} » existe déjà.`);
      }
      throw err;
    }
  }

  async createCashier(input: { name: string }) {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Le nom du caissier est obligatoire.');
    }
    const rows = await this.db.selectFrom('cashiers').select(['id', 'name']).execute();
    if (rows.some((row) => namesMatch(row.name, name))) {
      throw new Error(`Le caissier « ${name} » existe déjà.`);
    }
    try {
      return await this.db
        .insertInto('cashiers')
        .values({ name })
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new Error(`Le caissier « ${name} » existe déjà.`);
      }
      throw err;
    }
  }

  async createExpenseCategory(input: {
    name: string;
    description?: string | null;
  }) {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Le nom de la catégorie est obligatoire.');
    }
    const rows = await this.db
      .selectFrom('expense_categories')
      .select(['id', 'name'])
      .execute();
    if (rows.some((row) => namesMatch(row.name, name))) {
      throw new Error(`La catégorie de dépense « ${name} » existe déjà.`);
    }
    try {
      return await this.db
        .insertInto('expense_categories')
        .values({ name, description: input.description ?? null })
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new Error(`La catégorie de dépense « ${name} » existe déjà.`);
      }
      throw err;
    }
  }

  async updatePaymentCategory(
    id: number,
    input: { name: string; description?: string | null },
  ): Promise<void> {
    await this.db
      .updateTable('payment_categories')
      .set({
        name: input.name.trim(),
        description: input.description ?? null,
      })
      .where('id', '=', id)
      .execute();
  }

  async deletePaymentCategory(id: number): Promise<void> {
    const inUse = await this.db
      .selectFrom('payments')
      .select('id')
      .where('category_id', '=', id)
      .executeTakeFirst();
    if (inUse) {
      throw new Error(
        'Impossible de supprimer cette catégorie : elle est utilisée par au moins un paiement.',
      );
    }

    await this.db
      .deleteFrom('payment_categories')
      .where('id', '=', id)
      .execute();
  }

  async updateCashier(id: number, input: { name: string }): Promise<void> {
    await this.db
      .updateTable('cashiers')
      .set({ name: input.name.trim() })
      .where('id', '=', id)
      .execute();
  }

  async deleteCashier(id: number): Promise<void> {
    const paymentUse = await this.db
      .selectFrom('payments')
      .select('id')
      .where('cashier_id', '=', id)
      .executeTakeFirst();
    const staffPaymentUse = await this.db
      .selectFrom('staff_payments')
      .select('id')
      .where('cashier_id', '=', id)
      .executeTakeFirst();
    if (paymentUse || staffPaymentUse) {
      throw new Error(
        'Impossible de supprimer ce caissier : il est référencé par au moins un paiement.',
      );
    }

    await this.db.deleteFrom('cashiers').where('id', '=', id).execute();
  }
}
