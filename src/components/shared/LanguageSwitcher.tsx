"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { locales, languageNames, type Locale } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLanguageChange = (newLocale: string) => {
    setLocale(newLocale as Locale);
  };

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <Skeleton className="h-10 w-[140px]" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select value={locale} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {locales.map((lang) => (
            <SelectItem key={lang} value={lang}>
              {languageNames[lang]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
