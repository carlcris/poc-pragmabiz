"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { languageNames, localeCookieName, locales, type Locale } from "@/lib/i18n";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  const handleLanguageChange = (newLocale: string) => {
    localStorage.setItem("preferredLanguage", newLocale);
    document.cookie = `${localeCookieName}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = newLocale;
    router.refresh();
  };

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
