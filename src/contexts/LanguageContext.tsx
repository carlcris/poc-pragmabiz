"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Locale } from "@/lib/i18n";
import { defaultLocale } from "@/lib/i18n";
import { translations, type TranslationKeys } from "@/lib/i18n/translations";

type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  // Load saved locale from localStorage on mount
  useEffect(() => {
    const savedLocale = localStorage.getItem("preferredLanguage") as Locale;
    if (savedLocale && translations[savedLocale]) {
      setLocaleState(savedLocale);
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("preferredLanguage", newLocale);
    // Update HTML lang attribute
    document.documentElement.lang = newLocale;
  }, []);

  // Get current translations
  const t = translations[locale];

  // Memoize context value to prevent unnecessary re-renders but ensure it updates when locale changes
  const contextValue = React.useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  // Prevent hydration mismatch by rendering default locale on server
  if (!mounted) {
    return (
      <LanguageContext.Provider
        value={{ locale: defaultLocale, setLocale, t: translations[defaultLocale] }}
      >
        {children}
      </LanguageContext.Provider>
    );
  }

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

/**
 * Hook to get just the translation function
 * Usage: const t = useTranslation();
 * Then: <button>{t.common.save}</button>
 */
export function useTranslation() {
  const { t } = useLanguage();
  return t;
}
