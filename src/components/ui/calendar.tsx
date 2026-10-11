import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DayPicker,
  getDefaultClassNames,
  type DayPickerProps,
} from 'react-day-picker';
import { fr } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { cn } from '../../lib/utils';

export type CalendarProps = DayPickerProps;

const defaultClassNames = getDefaultClassNames();

const navButtonClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-transparent p-0 text-foreground opacity-80 transition-colors hover:bg-accent hover:opacity-100 disabled:pointer-events-none disabled:opacity-30';

const dayButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-sm font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';

/** French calendar styled for the glass-over-gradient theme. */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={fr}
      showOutsideDays={showOutsideDays}
      navLayout="around"
      className={cn('rdp-root p-3', className)}
      classNames={{
        ...defaultClassNames,
        month: cn(defaultClassNames.month, 'relative space-y-3'),
        month_caption: cn(
          defaultClassNames.month_caption,
          'flex items-center justify-center',
        ),
        caption_label: cn(
          defaultClassNames.caption_label,
          'text-sm font-semibold text-foreground',
        ),
        button_previous: cn(defaultClassNames.button_previous, navButtonClass),
        button_next: cn(defaultClassNames.button_next, navButtonClass),
        month_grid: cn(defaultClassNames.month_grid, 'w-full'),
        weekday: cn(
          defaultClassNames.weekday,
          'w-9 text-[0.75rem] font-medium text-muted-foreground',
        ),
        day: cn(defaultClassNames.day, 'p-0 text-center text-sm'),
        day_button: cn(defaultClassNames.day_button, dayButtonClass),
        selected: cn(
          defaultClassNames.selected,
          'rounded-md bg-primary text-primary-foreground [&_.rdp-day_button]:bg-transparent [&_.rdp-day_button]:text-inherit [&_.rdp-day_button]:hover:bg-primary/90',
        ),
        today: cn(
          defaultClassNames.today,
          'rounded-md bg-accent/80 text-accent-foreground [&_.rdp-day_button]:font-semibold',
        ),
        outside: cn(defaultClassNames.outside, 'text-muted-foreground opacity-45'),
        disabled: cn(defaultClassNames.disabled, 'text-muted-foreground opacity-35'),
        hidden: cn(defaultClassNames.hidden, 'invisible'),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
          return (
            <Icon
              className={cn('h-4 w-4', chevronClassName)}
              {...chevronProps}
            />
          );
        },
      }}
      {...props}
    />
  );
}
