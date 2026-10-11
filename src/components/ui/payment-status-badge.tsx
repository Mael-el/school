import {
  CheckCircle2,
  CircleDollarSign,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { translatePaymentBalanceStatus } from '../../lib/i18n-domain';
import { useTranslation } from 'react-i18next';

export type BalanceStatus =
  'Non payé' | 'Paiement partiel' | 'Payé' | 'Trop-perçu';

const STATUS_STYLES: Record<
  BalanceStatus,
  { className: string; icon: typeof CheckCircle2 }
> = {
  Payé: {
    className: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
    icon: CheckCircle2,
  },
  'Paiement partiel': {
    className: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
    icon: CircleDollarSign,
  },
  'Non payé': {
    className: 'bg-red-400/15 text-red-300 border-red-400/30',
    icon: XCircle,
  },
  'Trop-perçu': {
    className: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
    icon: AlertCircle,
  },
};

export function PaymentStatusBadge({ status }: { status: BalanceStatus }) {
  const { t } = useTranslation();
  const { className, icon: Icon } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {translatePaymentBalanceStatus(status, t)}
    </span>
  );
}
