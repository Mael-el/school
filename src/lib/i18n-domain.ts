import type { TFunction } from 'i18next';
import type { BalanceStatus } from '../components/ui/payment-status-badge';

const PAYMENT_BALANCE_KEYS: Record<BalanceStatus, string> = {
  Payé: 'status.paymentBalance.paid',
  'Paiement partiel': 'status.paymentBalance.partial',
  'Non payé': 'status.paymentBalance.unpaid',
  'Trop-perçu': 'status.paymentBalance.overpaid',
};

export function translatePaymentBalanceStatus(
  status: string,
  t: TFunction,
): string {
  const key = PAYMENT_BALANCE_KEYS[status as BalanceStatus];
  return key ? t(key) : status;
}

export function translateGender(value: string | null | undefined, t: TFunction): string {
  if (!value) return t('common.dash');
  if (value === 'Fille') return t('enum.gender.female');
  if (value === 'Garçon') return t('enum.gender.male');
  return value;
}

export function translateSection(value: string | null | undefined, t: TFunction): string {
  if (!value) return t('common.dash');
  if (value === 'Francophone') return t('enum.section.francophone');
  if (value === 'Anglophone') return t('enum.section.anglophone');
  return value;
}

export function translatePaymentMode(value: string, t: TFunction): string {
  const map: Record<string, string> = {
    Espèces: 'enum.paymentMode.cash',
    'MTN Mobile Money': 'enum.paymentMode.mtn',
    'Orange Money': 'enum.paymentMode.orange',
    'Virement bancaire': 'enum.paymentMode.transfer',
    Chèque: 'enum.paymentMode.cheque',
  };
  const key = map[value];
  return key ? t(key) : value;
}

export function translateTerm(
  value: string | null | undefined,
  t: TFunction,
): string {
  if (!value) return t('common.dash');
  const map: Record<string, string> = {
    '1er trimestre': 'enum.term.first',
    '2e trimestre': 'enum.term.second',
    '3e trimestre': 'enum.term.third',
  };
  const key = map[value];
  return key ? t(key) : value;
}

export function translateTransactionStatus(value: string, t: TFunction): string {
  if (value === 'Validé') return t('status.transaction.validated');
  return value;
}

export function translateStaffPaymentType(value: string, t: TFunction): string {
  const map: Record<string, string> = {
    Salaire: 'enum.staffPaymentType.salary',
    Avance: 'enum.staffPaymentType.advance',
    Prime: 'enum.staffPaymentType.bonus',
    Autre: 'enum.staffPaymentType.other',
  };
  const key = map[value];
  return key ? t(key) : value;
}
