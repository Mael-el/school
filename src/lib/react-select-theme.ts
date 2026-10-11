import type { ClassNamesConfig, GroupBase, StylesConfig } from 'react-select';
import { DROPDOWN_Z_INDEX } from './field-styles';
import { cn } from './utils';

export interface AppSelectOption {
  value: string;
  label: string;
  isDisabled?: boolean;
}

export function getSelectClassNames(
  className?: string,
): ClassNamesConfig<AppSelectOption, false, GroupBase<AppSelectOption>> {
  return {
    container: () => cn('w-full', className),
    control: ({ isFocused, isDisabled }) =>
      cn(
        'flex h-11 w-full cursor-default items-center rounded-xl border',
        'border-white/15 bg-white/[0.07]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_1px_2px_rgba(0,0,0,0.28)]',
        'text-[0.9375rem] font-medium transition-[border-color,box-shadow,background-color]',
        'hover:border-white/25 hover:bg-white/[0.1]',
        isFocused &&
          'border-primary/70 bg-white/[0.1] ring-2 ring-primary/35',
        isDisabled && 'cursor-not-allowed opacity-50',
      ),
    valueContainer: () => 'flex min-w-0 flex-1 items-center px-3.5',
    singleValue: () => 'truncate font-medium text-foreground',
    placeholder: () => 'truncate font-normal text-white/40',
    input: () => 'hidden',
    indicatorsContainer: () => 'flex shrink-0 items-center gap-0.5 pr-2',
    clearIndicator: () =>
      'cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground',
    dropdownIndicator: () =>
      'cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground',
    indicatorSeparator: () => 'hidden',
    menu: () =>
      cn(
        'overflow-hidden rounded-xl border border-white/15',
        'bg-[#160826] shadow-2xl shadow-black/50',
      ),
    menuList: () => 'max-h-64 overflow-y-auto p-1',
    option: ({ isFocused, isSelected, isDisabled }) =>
      cn(
        'flex w-full cursor-pointer items-center rounded-md px-3 py-2.5 text-sm',
        'whitespace-nowrap transition-colors duration-150',
        isDisabled && 'cursor-not-allowed opacity-40',
        isSelected && 'bg-primary/45 font-semibold text-white',
        isSelected && isFocused && 'bg-primary/60',
        !isSelected && isFocused && 'bg-white/[0.16] font-medium text-white',
        !isSelected && !isFocused && 'font-medium text-white/80',
      ),
    noOptionsMessage: () => 'px-3 py-3 text-sm text-muted-foreground',
  };
}

export function getSelectStyles(
  minMenuWidth = 0,
): StylesConfig<AppSelectOption, false, GroupBase<AppSelectOption>> {
  return {
    menuPortal: (base) => ({
      ...base,
      zIndex: DROPDOWN_Z_INDEX,
      pointerEvents: 'auto',
    }),
    menu: (base) => ({
      ...base,
      width: 'max-content',
      minWidth: Math.max(minMenuWidth, 160),
      maxWidth: 'min(36rem, calc(100vw - 1.5rem))',
    }),
    option: (base) => ({
      ...base,
      whiteSpace: 'nowrap',
    }),
  };
}

/** @deprecated Use getSelectStyles() */
export const selectMenuPortalStyles = getSelectStyles();
