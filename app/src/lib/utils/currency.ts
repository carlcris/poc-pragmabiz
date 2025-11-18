/**
 * Default currency configuration for the ERP system
 */
export const DEFAULT_CURRENCY = "PHP";
export const DEFAULT_LOCALE = "en-PH";

/**
 * Format a number as currency using the default currency (PHP)
 * @param amount - The amount to format
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency: DEFAULT_CURRENCY,
  }).format(amount);
}

/**
 * Format a number as currency with custom locale and currency
 * @param amount - The amount to format
 * @param currency - Currency code (e.g., "PHP", "USD")
 * @param locale - Locale code (e.g., "en-PH", "en-US")
 * @returns Formatted currency string
 */
export function formatCurrencyCustom(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
  }).format(amount);
}
