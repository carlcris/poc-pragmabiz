import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  exchangeRate: number;
}

interface CurrencyStore {
  currencies: Currency[];
  currentCurrency: Currency;
  baseCurrency: Currency;
  setCurrency: (currency: Currency) => void;
  addCurrency: (currency: Currency) => void;
  updateExchangeRate: (code: string, rate: number) => void;
}

const defaultCurrencies: Currency[] = [
  { code: "PHP", symbol: "₱", name: "Philippine Peso", exchangeRate: 56.5 },
  { code: "USD", symbol: "$", name: "US Dollar", exchangeRate: 1.0 },
  { code: "EUR", symbol: "€", name: "Euro", exchangeRate: 0.92 },
  { code: "GBP", symbol: "£", name: "British Pound", exchangeRate: 0.79 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", exchangeRate: 149.5 },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", exchangeRate: 7.24 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", exchangeRate: 83.12 },
];

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set) => ({
      currencies: defaultCurrencies,
      currentCurrency: defaultCurrencies[0],
      baseCurrency: defaultCurrencies[1],
      setCurrency: (currency) => set({ currentCurrency: currency }),
      addCurrency: (currency) =>
        set((state) => ({
          currencies: [...state.currencies, currency],
        })),
      updateExchangeRate: (code, rate) =>
        set((state) => ({
          currencies: state.currencies.map((curr) =>
            curr.code === code ? { ...curr, exchangeRate: rate } : curr
          ),
        })),
    }),
    {
      name: "currency-storage",
    }
  )
);
