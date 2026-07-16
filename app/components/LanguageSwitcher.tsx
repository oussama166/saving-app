'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { LOCALES, LOCALE_LABELS, LOCALE_FLAGS, type Locale } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (next: Locale) => {
    setLocale(next);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={LOCALE_LABELS[locale]}
        aria-label="Changer de langue"
        aria-expanded={open}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-subtle hover:text-body hover:bg-surface-strong transition-colors text-[11px] font-bold"
      >
        <Globe className="w-3.5 h-3.5" />
        {LOCALE_FLAGS[locale]}
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-40 bg-surface border border-line rounded-xl shadow-2xl overflow-hidden z-50">
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => handleSelect(code)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-medium transition-colors ${
                code === locale ? 'text-blue-400 bg-blue-500/10' : 'text-body-soft hover:bg-surface-alt'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-subtle w-6">{LOCALE_FLAGS[code]}</span>
                {LOCALE_LABELS[code]}
              </span>
              {code === locale && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
