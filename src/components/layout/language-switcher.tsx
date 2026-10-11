import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select } from '../ui/select';
import {
  UI_LANGUAGE_KEY,
  UI_LANGUAGE_STORAGE_KEY,
  normalizeUiLanguage,
  type UiLanguage,
} from '../../i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleChange = async (lang: UiLanguage) => {
    await i18n.changeLanguage(lang);
    try {
      localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors.
    }
    try {
      await window.api.settings.set(UI_LANGUAGE_KEY, lang);
    } catch {
      // IPC may be unavailable during startup.
    }
  };

  const current = normalizeUiLanguage(i18n.language);

  return (
    <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/80 backdrop-blur-sm">
      <Languages className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
      <span className="sr-only">{t('shell.language')}</span>
      <Select
        native
        value={current}
        onChange={(e) => void handleChange(normalizeUiLanguage(e.target.value))}
        className="h-7 w-[4.5rem] border-none bg-transparent px-1 text-sm text-white focus-visible:ring-0"
        aria-label={t('shell.language')}
      >
        <option value="fr" className="text-black">
          FR
        </option>
        <option value="en" className="text-black">
          EN
        </option>
      </Select>
    </label>
  );
}
