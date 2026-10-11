import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';

export function PageBackHeader({
  title,
  subtitle,
  onBack,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack: () => void;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold leading-tight tracking-tight">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
