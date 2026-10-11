import { useEffect, useRef } from 'react';
// Subpath exports are valid for intl-tel-input v29; eslint's resolver misses them.
// eslint-disable-next-line import/no-unresolved
import intlTelInput from 'intl-tel-input/intlTelInputWithUtils';
// eslint-disable-next-line import/no-unresolved
import 'intl-tel-input/styles';
import { cn } from '../../lib/utils';
import { fieldControlClasses } from '../../lib/field-styles';

type ItiInstance = ReturnType<typeof intlTelInput>;

export function PhoneInput({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itiRef = useRef<ItiInstance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return undefined;

    const iti = intlTelInput(input, {
      initialCountry: 'cm',
      countryOrder: ['cm', 'td', 'cf', 'ga', 'gq', 'ng'],
      separateDialCode: true,
      formatAsYouType: true,
      strictMode: true,
    });
    itiRef.current = iti;

    if (value.trim()) {
      iti.setNumber(value);
    }

    const emit = () => {
      const international = iti.getNumber();
      onChangeRef.current(international || input.value);
    };

    input.addEventListener('input', emit);
    input.addEventListener('countrychange', emit);

    return () => {
      input.removeEventListener('input', emit);
      input.removeEventListener('countrychange', emit);
      iti.destroy();
      itiRef.current = null;
    };
    // Initialise once; later value sync happens in the effect below.
  }, []);

  useEffect(() => {
    const iti = itiRef.current;
    if (!iti) return;
    const current = iti.getNumber();
    if (value && value !== current) {
      iti.setNumber(value);
    }
    if (!value && current) {
      iti.setNumber('');
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      className={cn(fieldControlClasses, 'iti-phone-field', className)}
    />
  );
}
