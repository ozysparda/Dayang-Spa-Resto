import { Languages } from 'lucide-react';
import { useLang } from '../stores/languageStore';

/**
 * Compact EN / ID toggle. Pairs nicely in the sidebar footer and the mobile
 * header so the language can be switched from anywhere in the app.
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();

  const btn = (value: 'en' | 'id', label: string) => {
    const active = lang === value;
    return (
      <button
        key={value}
        onClick={() => setLang(value)}
        aria-pressed={active}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
          active ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {label}
      </button>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {btn('en', 'EN')}
        {btn('id', 'ID')}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Languages className="w-4 h-4 text-gray-500" />
      {btn('en', 'English')}
      {btn('id', 'Bahasa Indonesia')}
    </div>
  );
}