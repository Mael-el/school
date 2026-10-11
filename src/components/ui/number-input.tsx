import * as React from 'react';
import { Input } from './input';

export type NumberInputMode = 'integer' | 'decimal';

export function sanitizeNumericInput(
  value: string,
  mode: NumberInputMode,
): string {
  if (mode === 'integer') return value.replace(/\D/g, '');
  const cleaned = value.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return `${cleaned.slice(0, firstDot + 1)}${cleaned
    .slice(firstDot + 1)
    .replace(/\./g, '')}`;
}

export const NumberInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
    mode?: NumberInputMode;
    onChange?: (value: string) => void;
  }
>(({ mode = 'decimal', value, defaultValue, onChange, onKeyDown, className, ...props }, ref) => (
  <Input
    ref={ref}
    type="text"
    inputMode={mode === 'integer' ? 'numeric' : 'decimal'}
    autoComplete="off"
    {...(value !== undefined ? { value } : { defaultValue })}
    className={className}
    onKeyDown={(event) => {
      if (['e', 'E', '+', '-'].includes(event.key)) {
        event.preventDefault();
      }
      onKeyDown?.(event);
    }}
    onChange={(event) => {
      const next = sanitizeNumericInput(event.target.value, mode);
      if (event.target.value !== next) {
        event.target.value = next;
      }
      onChange?.(next);
    }}
    {...props}
  />
));
NumberInput.displayName = 'NumberInput';
