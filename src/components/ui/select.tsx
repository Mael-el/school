import * as React from 'react';
import ReactSelect, { components, type InputProps } from 'react-select';
import { cn } from '../../lib/utils';
import { nativeSelectClasses } from '../../lib/field-styles';
import {
  getSelectClassNames,
  getSelectStyles,
  type AppSelectOption,
} from '../../lib/react-select-theme';
import { SelectMenu } from './select-menu';

function childLabel(children: React.ReactNode): string {
  if (children == null) return '';
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(childLabel).join('');
  }
  return '';
}

function optionsFromChildren(children: React.ReactNode): AppSelectOption[] {
  const options: AppSelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const type = child.type;
    if (type === React.Fragment) {
      options.push(
        ...optionsFromChildren(
          (child.props as { children?: React.ReactNode }).children,
        ),
      );
      return;
    }
    const props = child.props as {
      value?: string | number;
      children?: React.ReactNode;
      disabled?: boolean;
    };
    const isOption =
      type === 'option' ||
      (typeof type === 'string' && type.toLowerCase() === 'option');
    if (!isOption) return;
    options.push({
      value: String(props.value ?? ''),
      label: childLabel(props.children),
      isDisabled: props.disabled,
    });
  });
  return options;
}

function HiddenControlInput(props: InputProps<AppSelectOption, false>) {
  return <components.Input {...props} isHidden />;
}

export interface SelectProps
  extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    'onChange' | 'value'
  > {
  value?: string | number | readonly string[];
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  /** Keep a lightweight native `<select>` (toolbar / header). */
  native?: boolean;
  /** Enable type-to-search in the dropdown (default: on). */
  searchable?: boolean;
}

/**
 * Desktop dropdown — powered by react-select (Select2-style search & styling).
 * Pass `native` for compact toolbar selects.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      children,
      value,
      onChange,
      disabled,
      id,
      name,
      native = false,
      searchable = true,
      ...props
    },
    _ref,
  ) => {
    const reactId = React.useId();
    const rootRef = React.useRef<HTMLDivElement>(null);
    const [menuMinWidth, setMenuMinWidth] = React.useState(0);
    const options = React.useMemo(
      () => optionsFromChildren(children),
      [children],
    );
    const stringValue = value == null ? '' : String(value);
    const emptyOption = options.find((option) => option.value === '');
    const placeholder = emptyOption?.label || '—';
    const allOptions = emptyOption
      ? options.filter((option) => option.value !== '')
      : options;
    const selected =
      allOptions.find((option) => option.value === stringValue) ?? null;

    if (native) {
      return (
        <select
          id={id}
          name={name}
          value={stringValue}
          disabled={disabled}
          onChange={onChange}
          className={cn(nativeSelectClasses, className)}
          {...props}
        >
          {children}
        </select>
      );
    }

    return (
      <div ref={rootRef} className="min-w-0 w-full">
        <ReactSelect<AppSelectOption, false>
          inputId={id}
          instanceId={id ?? name ?? reactId}
          name={name}
          options={allOptions}
          value={selected}
          isDisabled={disabled}
          isSearchable={searchable}
          isClearable={Boolean(emptyOption && stringValue)}
          placeholder={placeholder}
          menuPortalTarget={
            typeof document !== 'undefined' ? document.body : undefined
          }
          menuPlacement="auto"
          menuShouldScrollIntoView={false}
          closeMenuOnSelect
          blurInputOnSelect
          classNames={getSelectClassNames(className)}
          styles={getSelectStyles(menuMinWidth)}
          components={{
            Input: HiddenControlInput,
            Menu: SelectMenu,
          }}
          onMenuOpen={() => {
            setMenuMinWidth(rootRef.current?.offsetWidth ?? 0);
          }}
          onChange={(option) => {
            onChange?.({
              target: { value: option?.value ?? '' },
            } as React.ChangeEvent<HTMLSelectElement>);
          }}
          unstyled
          aria-label={props['aria-label']}
        />
      </div>
    );
  },
);
Select.displayName = 'Select';
