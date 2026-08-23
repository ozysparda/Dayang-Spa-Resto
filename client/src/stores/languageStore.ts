import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Lang, Vars, translate } from '../i18n/translations';

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
    }),
    {
      name: 'language-storage',
    }
  )
);

export interface Translator {
  (key: string, vars?: Vars): string;
}

/**
 * Reactive translation hook. Calling this inside a component subscribes it to
 * the store so all translated strings update as soon as the language changes.
 */
export function useLang(): {
  lang: Lang;
  t: Translator;
  setLang: (lang: Lang) => void;
} {
  const { lang, setLang } = useLanguageStore();
  const t: Translator = (key, vars) => translate(lang, key, vars);
  return { lang, t, setLang };
}