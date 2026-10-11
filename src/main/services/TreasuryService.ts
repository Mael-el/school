// Phase 8 — Trésorerie consolidée. Reads from the `cashflow_summary` SQL
// view (schema-types.ts / migrations/001_initial_schema.ts) which already
// unions revenue/expense/salary totals per month,
// then pivots the three `type` rows per period into a single
// { period, revenue, expenses, salaries, net } shape in application code —
// simpler for the renderer (one row per month) than consuming the raw
// long-format view directly.
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema-types';

export interface MonthlyCashflow {
  /** "YYYY-MM" */
  period: string;
  revenue: number;
  expenses: number;
  salaries: number;
  net: number;
}

export interface CashflowTotals {
  revenue: number;
  expenses: number;
  salaries: number;
  net: number;
}

export interface CashflowFilters {
  /** "YYYY-MM", inclusive */
  from?: string;
  /** "YYYY-MM", inclusive */
  to?: string;
}

export class TreasuryService {
  constructor(private readonly db: Kysely<Database>) {}

  /** Une ligne par mois, recettes/dépenses/salaires/solde net pivotés. */
  async monthlySummary(
    filters: CashflowFilters = {},
  ): Promise<MonthlyCashflow[]> {
    let query = this.db.selectFrom('cashflow_summary').selectAll();
    if (filters.from) query = query.where('period', '>=', filters.from);
    if (filters.to) query = query.where('period', '<=', filters.to);

    const rows = await query.orderBy('period').execute();

    const byPeriod = new Map<string, MonthlyCashflow>();
    for (const row of rows) {
      const entry = byPeriod.get(row.period) ?? {
        period: row.period,
        revenue: 0,
        expenses: 0,
        salaries: 0,
        net: 0,
      };
      const amount = Number(row.total ?? 0);
      if (row.type === 'Recette frais scolaires') entry.revenue += amount;
      // `expenses`/`salaries` are stored as negative totals in the view
      // (see cashflow_summary UNION ALL) — flip the sign for display.
      else if (row.type === 'Dépense') entry.expenses += -amount;
      else if (row.type === 'Salaire personnel') entry.salaries += -amount;
      byPeriod.set(row.period, entry);
    }

    const result = [...byPeriod.values()].sort((a, b) =>
      a.period.localeCompare(b.period),
    );
    for (const entry of result) {
      entry.net = entry.revenue - entry.expenses - entry.salaries;
    }
    return result;
  }

  /** Totaux consolidés (recettes/dépenses/salaires/solde net) sur la période. */
  async totals(filters: CashflowFilters = {}): Promise<CashflowTotals> {
    const monthly = await this.monthlySummary(filters);
    return monthly.reduce<CashflowTotals>(
      (acc, m) => ({
        revenue: acc.revenue + m.revenue,
        expenses: acc.expenses + m.expenses,
        salaries: acc.salaries + m.salaries,
        net: acc.net + m.net,
      }),
      { revenue: 0, expenses: 0, salaries: 0, net: 0 },
    );
  }
}
