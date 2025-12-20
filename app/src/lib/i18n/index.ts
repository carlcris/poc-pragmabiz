/**
 * Client-side i18n implementation for Next.js App Router
 *
 * This provides a simple, client-side translation system that works
 * seamlessly with Next.js 13+ App Router.
 */

export const locales = ['en', 'es', 'fr', 'de', 'zh', 'ja'] as const;
export type Locale = typeof locales[number];

export const defaultLocale: Locale = 'en';

export const languageNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  zh: '中文',
  ja: '日本語',
};
