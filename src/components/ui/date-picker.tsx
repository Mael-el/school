import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fieldTriggerClasses } from '../../lib/field-styles';
import {
  DISPLAY_DATE_LONG,
  formatDisplayDate,
  parseIsoDate,
  toIsoDate,
} from '../../lib/dates';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  monthYearDropdowns?: boolean;
  startMonth?: Date;
  endMonth?: Date;
  className?: string;
  id?: string;
}

/** Popover date picker — stores ISO `yyyy-MM-dd`, displays in the active UI locale. */
export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  monthYearDropdowns = false,
  startMonth,
  endMonth,
  className,
  id,
}: DatePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);
  const resolvedPlaceholder = placeholder ?? t('datePicker.pickDate');

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          {value
            ? formatDisplayDate(value, DISPLAY_DATE_LONG)
            : resolvedPlaceholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto border-white/10 bg-[#1c0b30]/95 p-0 shadow-xl backdrop-blur-xl">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onChange(toIsoDate(date));
              setOpen(false);
            }
          }}
          defaultMonth={selected}
          captionLayout={monthYearDropdowns ? 'dropdown' : 'label'}
          startMonth={startMonth}
          endMonth={endMonth}
          reverseYears={monthYearDropdowns}
        />
      </PopoverContent>
    </Popover>
  );
}
