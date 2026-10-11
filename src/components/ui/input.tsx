import * as React from 'react';
import { cn } from '../../lib/utils';
import { fieldControlClasses } from '../../lib/field-styles';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(fieldControlClasses, className)}
    {...props}
  />
));
Input.displayName = 'Input';
