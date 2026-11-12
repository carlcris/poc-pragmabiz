"use client";

import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  triggerClassName?: string;
};

export function LanguageSwitcher({ triggerClassName }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLanguageChange = (newLocale: string) => {
    localStorage.setItem("preferredLanguage", newLocale);
    document.cookie = `${localeCookieName}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = newLocale;
    router.refresh();
  };

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <Globe className="hidden h-4 w-4 text-muted-foreground xl:block" />
        <Skeleton className={cn("h-10 w-24 xl:w-[140px]", triggerClassName)} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Compact below xl so the header leaves the breadcrumb room beside the sidebar. */}
      <Globe className="hidden h-4 w-4 text-muted-foreground xl:block" />
      <Select value={locale} onValueChange={handleLanguageChange}>
        <SelectTrigger className={cn("w-auto gap-2 xl:w-[140px]", triggerClassName)}>
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
