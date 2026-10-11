export const OPERATIONAL_CLEAR_GROUPS = [
  'payments',
  'expenses',
  'staffPayments',
  'enrollments',
  'students',
  'staff',
  'audit',
] as const;

export const CONFIG_CLEAR_GROUPS = [
  'schoolIdentity',
  'schoolYear',
  'classes',
  'fees',
  'paymentCategories',
  'expenseCategories',
  'cashiers',
  'advancedOptions',
] as const;

export const CLEAR_GROUPS = [
  ...OPERATIONAL_CLEAR_GROUPS,
  ...CONFIG_CLEAR_GROUPS,
] as const;

export type ClearGroup = (typeof CLEAR_GROUPS)[number];

export type ClearSelection = Partial<Record<ClearGroup, boolean>>;

export type ClearCounts = Record<ClearGroup, number>;

export interface ClearResult extends ClearCounts {
  countersReset: string[];
}

export function expandClearSelection(
  selection: ClearSelection,
): Record<ClearGroup, boolean> {
  const students = Boolean(selection.students);
  const staff = Boolean(selection.staff);
  const classes = Boolean(selection.classes);
  const enrollments =
    Boolean(selection.enrollments) || students || classes;
  const payments = Boolean(selection.payments) || enrollments;
  const staffPayments = Boolean(selection.staffPayments) || staff;
  const fees = Boolean(selection.fees) || classes;
  return {
    payments,
    expenses: Boolean(selection.expenses),
    staffPayments,
    enrollments,
    students,
    staff,
    audit: Boolean(selection.audit),
    schoolIdentity: Boolean(selection.schoolIdentity),
    schoolYear: Boolean(selection.schoolYear),
    classes,
    fees,
    paymentCategories: Boolean(selection.paymentCategories),
    expenseCategories: Boolean(selection.expenseCategories),
    cashiers: Boolean(selection.cashiers),
    advancedOptions: Boolean(selection.advancedOptions),
  };
}

export function selectedClearGroups(selection: ClearSelection): ClearGroup[] {
  return CLEAR_GROUPS.filter((group) => expandClearSelection(selection)[group]);
}
