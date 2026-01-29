"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrencyStore } from "@/stores/currencyStore";

export function CurrencySwitcher() {
  const { currencies, currentCurrency, setCurrency } = useCurrencyStore();

  const handleCurrencyChange = (code: string) => {
    const currency = currencies.find((c) => c.code === code);
    if (currency) {
      setCurrency(currency);
    }
  };

  return (
    <Select value={currentCurrency.code} onValueChange={handleCurrencyChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((curr) => (
          <SelectItem key={curr.code} value={curr.code}>
            {curr.symbol} {curr.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
