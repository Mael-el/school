import { cn } from './utils';

/** Shared desktop-style control chrome for text inputs and triggers. */
export const fieldControlClasses = cn(
  'flex h-11 w-full items-center rounded-xl border border-white/15',
  'bg-white/[0.07] px-3.5 text-[0.9375rem] font-medium leading-none text-foreground',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_1px_2px_rgba(0,0,0,0.28)]',
  'placeholder:text-white/40 placeholder:font-normal',
  'transition-[border-color,box-shadow,background-color]',
  'hover:border-white/25 hover:bg-white/[0.1]',
  'focus-visible:outline-none focus-visible:border-primary/70',
  'focus-visible:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-primary/35',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

/** Compact native `<select>` for toolbar / header embeds. */
export const nativeSelectClasses = cn(
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1',
  'text-sm font-medium shadow-sm transition-colors',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

/** Trigger button styling aligned with text fields (date / month pickers). */
export const fieldTriggerClasses = cn(
  fieldControlClasses,
  'justify-start font-medium',
);

export const DROPDOWN_Z_INDEX = 10000;
