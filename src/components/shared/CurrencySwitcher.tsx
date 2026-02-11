"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { useCurrencyStore } from "@/stores/currencyStore";
import { Skeleton } from "@/components/ui/skeleton";

export function CurrencySwitcher() {
  const { currencies, currentCurrency, setCurrency } = useCurrencyStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCurrencyChange = (code: string) => {
    const currency = currencies.find((c) => c.code === code);
    if (currency) {
      setCurrency(currency);
    }
  };

  if (!mounted) {
    return <Skeleton className="h-10 w-[140px]" />;
  }

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
