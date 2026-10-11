import { describe, expect, it } from 'vitest';
import { buildCashflowTotals, buildMonthlyCashflow } from './treasury-stats';
import type { Expense, Payment, StaffPayment } from './types';

describe('treasury-stats', () => {
  it('builds monthly cashflow and totals', () => {
    const payments: Payment[] = [
      {
        id: 1,
        receipt_no: 'R1',
        enrollment_id: 1,
        payment_date: '2026-09-10',
        category_id: null,
        term: null,
        installment_no: null,
        amount: 100000,
        payment_mode: 'Espèces',
        transaction_ref: null,
        cashier_id: null,
        note: null,
        status: 'Validé',
        cancelled_at: null,
        cancelled_reason: null,
        created_at: '',
      },
    ];
    const expenses: Expense[] = [
      {
        id: 1,
        reference_no: 'D1',
        expense_date: '2026-09-15',
        category_id: 1,
        description: 'Fournitures',
        amount: 20000,
        payment_mode: 'Espèces',
        supplier_name: null,
        receipt_ref: null,
        approved_by: null,
        note: null,
        status: 'Validé',
        cancelled_at: null,
        cancelled_reason: null,
        created_at: '',
      },
    ];
    const staffPayments: StaffPayment[] = [
      {
        id: 1,
        receipt_no: 'S1',
        staff_id: 1,
        payment_date: '2026-09-30',
        pay_period: '2026-09',
        amount: 150000,
        payment_type: 'Salaire',
        payment_mode: 'Espèces',
        transaction_ref: null,
        cashier_id: null,
        note: null,
        status: 'Validé',
        cancelled_at: null,
        cancelled_reason: null,
        created_at: '',
      },
    ];

    const monthly = buildMonthlyCashflow(payments, expenses, staffPayments);
    expect(monthly).toEqual([
      {
        period: '2026-09',
        revenue: 100000,
        expenses: 20000,
        salaries: 150000,
        net: -70000,
      },
    ]);
    expect(buildCashflowTotals(monthly)).toEqual({
      revenue: 100000,
      expenses: 20000,
      salaries: 150000,
      net: -70000,
    });
  });
});
