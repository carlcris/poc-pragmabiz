import { useCurrencyStore } from "@/stores/currencyStore";

/**
 * Hook to format currency based on the current currency selection
 */
export function useCurrency() {
  const { currentCurrency } = useCurrencyStore();

  const formatCurrency = (amount: number): string => {
    // Determine locale based on currency code
    const locale = currentCurrency.code === "PHP" ? "en-PH" : "en-US";

    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currentCurrency.code,
    }).format(amount);
  };

  const formatAmount = (amount: number): string => {
    return amount.toLocaleString();
  };

  return {
    formatCurrency,
    formatAmount,
    currentCurrency,
    symbol: currentCurrency.symbol,
    code: currentCurrency.code,
  };
}
