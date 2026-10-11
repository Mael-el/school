import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fieldTriggerClasses } from '../../lib/field-styles';
import {
  formatDisplayMonth,
  getMonthLabels,
  parseIsoMonth,
  toIsoMonth,
} from '../../lib/dates';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Allow clearing the selection. */
  clearable?: boolean;
}

/** Month picker — stores ISO `yyyy-MM`, displays in the active UI locale. */
export function MonthPicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  id,
  clearable = true,
}: MonthPickerProps) {
  const { t, i18n } = useTranslation();
  const monthLabels = useMemo(() => getMonthLabels(), [i18n.language]);
  const [open, setOpen] = useState(false);
  const parsed = parseIsoMonth(value);
  const [year, setYear] = useState(
    parsed?.getFullYear() ?? new Date().getFullYear(),
  );
  const selectedMonthIndex = parsed ? parsed.getMonth() : null;
  const resolvedPlaceholder = placeholder ?? t('datePicker.pickMonth');

  const selectMonth = (monthIndex: number) => {
    onChange(toIsoMonth(new Date(year, monthIndex, 1)));
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && parsed) setYear(parsed.getFullYear());
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            fieldTriggerClasses,
            !value && 'font-normal text-muted-foreground/75',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-80" />
          {value ? formatDisplayMonth(value) : resolvedPlaceholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="mb-3 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setYear((y) => y - 1)}
            aria-label={t('common.previousYear')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{year}</span>
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setYear((y) => y + 1)}
            aria-label={t('common.nextYear')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {monthLabels.map((label, index) => (
            <Button
              key={label}
              type="button"
              variant={
                selectedMonthIndex === index &&
                parsed?.getFullYear() === year
                  ? 'default'
                  : 'ghost'
              }
              className="h-8 px-1 text-xs capitalize"
              onClick={() => selectMonth(index)}
            >
              {label.slice(0, 3)}
            </Button>
          ))}
        </div>
        {clearable && value && (
          <Button
            type="button"
            variant="ghost"
            className="mt-2 h-8 w-full text-xs text-muted-foreground"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            {t('common.clear')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
