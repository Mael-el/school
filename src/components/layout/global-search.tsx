// En-tête : recherche globale d'élève par nom/matricule (docs/electron-app-plan.md
// section 10 "Recherche & filtres avancés" / raccourcis clavier). Ctrl/Cmd+K
// donne le focus (voir App.tsx), Échap referme les résultats.
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Student } from '../../lib/types';

export interface GlobalSearchHandle {
  focus: () => void;
}

export const GlobalSearch = React.forwardRef<
  GlobalSearchHandle,
  { onSelectStudent: (studentId: number) => void }
>(function GlobalSearch({ onSelectStudent }, ref) {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Student[]>([]);
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const list = await window.api.students.search(trimmed);
      if (!cancelled) setResults(list.slice(0, 8));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSelect = (student: Student) => {
    onSelectStudent(student.id);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur-sm">
        <Search className="h-4 w-4 shrink-0 text-white/50" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              inputRef.current?.blur();
            } else if (e.key === 'Enter' && results.length > 0) {
              handleSelect(results[0]);
            }
          }}
          placeholder={t('search.placeholder')}
          aria-label={t('search.ariaLabel')}
          className="h-6 w-48 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
        />
      </div>

      {open && results.length > 0 && (
        <ul className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#241141]/95 py-1 shadow-2xl backdrop-blur-xl">
          {results.map((student) => (
            <li key={student.id}>
              <button
                type="button"
                onClick={() => handleSelect(student)}
                className={cn(
                  'flex w-full flex-col items-start px-4 py-2 text-left text-sm text-white/90 transition-colors hover:bg-white/10',
                )}
              >
                <span className="font-medium">{student.full_name}</span>
                <span className="text-xs text-white/50">
                  {student.matricule}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
