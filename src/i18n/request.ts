import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, localeCookieName, locales, type Locale } from "@/lib/i18n";
import { translations } from "@/lib/i18n/translations";

const isLocale = (value: string): value is Locale => {
  return locales.includes(value as Locale);
};

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const localeValue = cookieStore.get(localeCookieName)?.value;
  const locale = localeValue && isLocale(localeValue) ? localeValue : defaultLocale;

  return {
    locale,
    messages: translations[locale],
  };
});
