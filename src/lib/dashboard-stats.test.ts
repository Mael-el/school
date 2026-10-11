import { describe, expect, it } from 'vitest';
import {
  buildClassBalanceSummaries,
  buildMonthlyCollections,
} from './dashboard-stats';
import type { ClassLevel, EnrollmentBalance, Payment } from './types';

describe('dashboard-stats', () => {
  it('aggregates class balance summaries', () => {
    const classLevels: ClassLevel[] = [
      { id: 1, code: 'CP', name: 'CP', display_order: 1 },
      { id: 2, code: 'CE1', name: 'CE1', display_order: 2 },
    ];
    const balances: EnrollmentBalance[] = [
      {
        enrollment_id: 1,
        student_id: 1,
        matricule: 'A',
        full_name: 'Alice',
        school_year: '2026/2027',
        class_level_id: 1,
        section: 'Francophone',
        registration_no: null,
        class_name: 'CP',
        expected_fee: 100000,
        total_paid: 50000,
        balance: 50000,
        status: 'Paiement partiel',
      },
      {
        enrollment_id: 2,
        student_id: 2,
        matricule: 'B',
        full_name: 'Bob',
        school_year: '2026/2027',
        class_level_id: 1,
        section: 'Francophone',
        registration_no: null,
        class_name: 'CP',
        expected_fee: 100000,
        total_paid: 100000,
        balance: 0,
        status: 'Payé',
      },
    ];

    const result = buildClassBalanceSummaries(balances, classLevels);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      class_name: 'CP',
      expected_total: 200000,
      paid_total: 150000,
      balance_total: 50000,
    });
  });

  it('groups monthly collections from payments', () => {
    const payments: Payment[] = [
      {
        id: 1,
        receipt_no: 'R1',
        enrollment_id: 1,
        payment_date: '2026-09-10',
        category_id: null,
        term: null,
        installment_no: null,
        amount: 50000,
        payment_mode: 'Espèces',
        transaction_ref: null,
        cashier_id: null,
        note: null,
        status: 'Validé',
        cancelled_at: null,
        cancelled_reason: null,
        created_at: '',
      },
      {
        id: 2,
        receipt_no: 'R2',
        enrollment_id: 1,
        payment_date: '2026-09-20',
        category_id: null,
        term: null,
        installment_no: null,
        amount: 30000,
        payment_mode: 'Espèces',
        transaction_ref: null,
        cashier_id: null,
        note: null,
        status: 'Validé',
        cancelled_at: null,
        cancelled_reason: null,
        created_at: '',
      },
      {
        id: 3,
        receipt_no: 'R3',
        enrollment_id: 2,
        payment_date: '2026-10-05',
        category_id: null,
        term: null,
        installment_no: null,
        amount: 20000,
        payment_mode: 'Espèces',
        transaction_ref: null,
        cashier_id: null,
        note: null,
        status: 'Annulé',
        cancelled_at: '2026-10-06',
        cancelled_reason: 'Erreur',
        created_at: '',
      },
    ];

    expect(buildMonthlyCollections(payments)).toEqual([
      { month: '2026-09', total: 80000 },
    ]);
  });
});
