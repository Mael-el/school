import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { components, type GroupBase, type MenuProps } from 'react-select';
import type { AppSelectOption } from '../../lib/react-select-theme';

export function SelectMenu(
  props: MenuProps<AppSelectOption, false, GroupBase<AppSelectOption>>,
) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { selectProps } = props;
  const searchable = selectProps.isSearchable !== false;

  return (
    <components.Menu {...props}>
      {searchable && (
        <div
          className="border-b border-white/10 px-3 pb-3 pt-3"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            inputRef.current?.focus();
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
            <input
              ref={inputRef}
              value={selectProps.inputValue}
              onChange={(event) =>
                selectProps.onInputChange(event.target.value, {
                  action: 'input-change',
                  prevInputValue: selectProps.inputValue,
                })
              }
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  selectProps.onMenuClose();
                }
              }}
              placeholder={t('common.searchSelect')}
              className="h-10 w-full rounded-lg border border-white/15 bg-white/[0.08] pl-9 pr-3 text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-white/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      )}
      {props.children}
    </components.Menu>
  );
}
