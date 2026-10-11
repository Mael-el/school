// Staff member CRUD + salary payment capture, receipt numbering (via
// `counters`, same pattern as PaymentService/ExpenseService) and
// cancellation (staff payments are never deleted — see
// docs/electron-app-plan.md section 4).
import type { Kysely, Selectable } from 'kysely';
import type {
  Database,
  StaffMembersTable,
  StaffPaymentsTable,
} from '../db/schema-types';
import { incrementCode } from '../../../shared/next-code';
import { logAudit } from './AuditLog';

export interface CreateStaffMemberInput {
  staff_no: string;
  full_name: string;
  role: string;
  class_level_id?: number | null;
  phone?: string | null;
  hire_date?: string | null;
  monthly_salary: number;
}

export interface CreateStaffPaymentInput {
  staff_id: number;
  payment_date: string;
  pay_period: string;
  amount: number;
  payment_type: 'Salaire' | 'Avance' | 'Prime' | 'Autre';
  payment_mode: string;
  transaction_ref?: string | null;
  cashier_id?: number | null;
  note?: string | null;
}

export interface StaffMonthlyBalance {
  id: number;
  staff_no: string;
  full_name: string;
  role: string;
  monthly_salary: number;
  paid: number;
  balance: number;
}

export class StaffService {
  constructor(private readonly db: Kysely<Database>) {}

  async list(): Promise<Selectable<StaffMembersTable>[]> {
    return this.db
      .selectFrom('staff_members')
      .selectAll()
      .orderBy('full_name')
      .execute() as unknown as Promise<Selectable<StaffMembersTable>[]>;
  }

  async nextStaffNo(): Promise<string> {
    const last = await this.db
      .selectFrom('staff_members')
      .select('staff_no')
      .orderBy('id', 'desc')
      .executeTakeFirst();
    return incrementCode(last?.staff_no, 'PER-001');
  }

  async getById(id: number) {
    return this.db
      .selectFrom('staff_members')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async create(input: CreateStaffMemberInput): Promise<Selectable<StaffMembersTable>> {
    const now = new Date().toISOString();
    const result = await this.db
      .insertInto('staff_members')
      .values({
        staff_no: input.staff_no,
        full_name: input.full_name,
        role: input.role,
        class_level_id: input.class_level_id ?? null,
        phone: input.phone ?? null,
        hire_date: input.hire_date ?? null,
        monthly_salary: input.monthly_salary,
        status: 'Actif',
        created_at: now,
        updated_at: now,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const id = Number(result.id);
    const staff = await this.getById(id);

    await logAudit(this.db, {
      action: 'CREATE',
      entity: 'staff_members',
      entityId: id,
      after: staff,
    });

    return staff as unknown as Selectable<StaffMembersTable>;
  }

  async update(
    id: number,
    input: Partial<
      CreateStaffMemberInput & { status: 'Actif' | 'Suspendu' | 'Sorti' }
    >,
  ): Promise<Selectable<StaffMembersTable> | undefined> {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Membre du personnel introuvable (id=${id})`);
    }

    await this.db
      .updateTable('staff_members')
      .set({ ...input, updated_at: new Date().toISOString() })
      .where('id', '=', id)
      .execute();

    const after = await this.getById(id);
    await logAudit(this.db, {
      action: 'UPDATE',
      entity: 'staff_members',
      entityId: id,
      before,
      after,
    });

    return after as unknown as Selectable<StaffMembersTable> | undefined;
  }

  /** Permanently removes a staff member and their salary payments. */
  async delete(id: number): Promise<void> {
    const before = await this.getById(id);
    if (!before) {
      throw new Error(`Membre du personnel introuvable (id=${id})`);
    }

    await this.db.transaction().execute(async (trx) => {
      const payments = await trx
        .selectFrom('staff_payments')
        .select('id')
        .where('staff_id', '=', id)
        .execute();
      const paymentIds = payments.map((p) => p.id);

      await trx.deleteFrom('staff_payments').where('staff_id', '=', id).execute();

      if (paymentIds.length > 0) {
        await trx
          .deleteFrom('audit_log')
          .where('entity', '=', 'staff_payments')
          .where('entity_id', 'in', paymentIds)
          .execute();
      }

      await trx
        .deleteFrom('audit_log')
        .where('entity', '=', 'staff_members')
        .where('entity_id', '=', id)
        .execute();
      await trx.deleteFrom('staff_members').where('id', '=', id).execute();
    });

    await logAudit(this.db, {
      action: 'DELETE',
      entity: 'staff_members',
      entityId: id,
      before,
    });
  }

  /** Personnel × mois sélectionné, avec LEFT JOIN pour inclure ceux sans
   * aucun paiement pour ce mois (cf. docs/electron-app-plan.md section 4.2 —
   * la vue `staff_payments_by_period` seule n'a pas de ligne pour un
   * (membre, mois) sans paiement). */
  async monthlyBalances(payPeriod: string): Promise<StaffMonthlyBalance[]> {
    const staff = await this.db
      .selectFrom('staff_members')
      .selectAll()
      .where('status', '=', 'Actif')
      .orderBy('full_name')
      .execute();

    const paidRows = await this.db
      .selectFrom('staff_payments')
      .select(['staff_id', (eb) => eb.fn.sum<number>('amount').as('paid')])
      .where('pay_period', '=', payPeriod)
      .where('status', '=', 'Validé')
      .groupBy('staff_id')
      .execute();

    const paidByStaff = new Map(paidRows.map((r) => [r.staff_id, r.paid]));

    return staff.map((s) => {
      const paid = paidByStaff.get(s.id) ?? 0;
      return {
        id: s.id,
        staff_no: s.staff_no,
        full_name: s.full_name,
        role: s.role,
        monthly_salary: s.monthly_salary,
        paid,
        balance: s.monthly_salary - paid,
      };
    });
  }

  async listPaymentsForStaff(staffId: number): Promise<Selectable<StaffPaymentsTable>[]> {
    return this.db
      .selectFrom('staff_payments')
      .selectAll()
      .where('staff_id', '=', staffId)
      .orderBy('payment_date')
      .execute() as unknown as Promise<Selectable<StaffPaymentsTable>[]>;
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

  async createPayment(
    input: CreateStaffPaymentInput,
    receiptPrefix: string,
  ): Promise<Selectable<StaffPaymentsTable>> {
    return this.db.transaction().execute(async (trx) => {
      const counterValue = await this.nextCounterValue(
        trx,
        'staff_payment_receipt',
      );
      const receiptNo = `${receiptPrefix}-${String(counterValue).padStart(4, '0')}`;

      const result = await trx
        .insertInto('staff_payments')
        .values({
          receipt_no: receiptNo,
          staff_id: input.staff_id,
          payment_date: input.payment_date,
          pay_period: input.pay_period,
          amount: input.amount,
          payment_type: input.payment_type,
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
        .selectFrom('staff_payments')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      await logAudit(trx, {
        action: 'CREATE',
        entity: 'staff_payments',
        entityId: id,
        after: payment,
      });

      return payment as unknown as Selectable<StaffPaymentsTable>;
    });
  }

  /** Never deletes a staff payment: marks it 'Annulé' with a reason,
   * mirroring PaymentService.cancel(). */
  async cancelPayment(id: number, reason: string): Promise<void> {
    const before = await this.db
      .selectFrom('staff_payments')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!before) {
      throw new Error(`Paiement de salaire introuvable (id=${id})`);
    }
    if (before.status === 'Annulé') {
      throw new Error('Ce paiement est déjà annulé.');
    }

    await this.db
      .updateTable('staff_payments')
      .set({
        status: 'Annulé',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: reason,
      })
      .where('id', '=', id)
      .execute();

    const after = await this.db
      .selectFrom('staff_payments')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    await logAudit(this.db, {
      action: 'CANCEL',
      entity: 'staff_payments',
      entityId: id,
      before,
      after,
      note: reason,
    });
  }

  /** Permanently removes a staff payment record. */
  async deletePayment(id: number): Promise<void> {
    const before = await this.db
      .selectFrom('staff_payments')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!before) {
      throw new Error(`Paiement de salaire introuvable (id=${id})`);
    }

    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('audit_log')
        .where('entity', '=', 'staff_payments')
        .where('entity_id', '=', id)
        .execute();
      await trx.deleteFrom('staff_payments').where('id', '=', id).execute();
    });

    await logAudit(this.db, {
      action: 'DELETE',
      entity: 'staff_payments',
      entityId: id,
      before,
    });
  }
}
