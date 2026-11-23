import { useLocale, useTranslations } from "next-intl";
import type {
  StockInTransitArrivalWindow,
  StockInTransitOrderedUnitTotal,
} from "@/types/stock-in-transit";

export const ARRIVAL_WINDOW_ORDER: readonly StockInTransitArrivalWindow[] = [
  "late",
  "next_7_days",
  "days_8_to_14",
  "later",
  "no_eta",
];

export const ARRIVAL_WINDOW_STYLES: Record<
  StockInTransitArrivalWindow,
  { marker: string; text: string }
> = {
  late: { marker: "bg-red-700 dark:bg-red-400", text: "text-red-700 dark:text-red-400" },
  next_7_days: {
    marker: "bg-amber-500 dark:bg-amber-400",
    text: "text-amber-800 dark:text-amber-300",
  },
  days_8_to_14: {
    marker: "bg-primary",
    text: "text-violet-700 dark:text-violet-300",
  },
  later: { marker: "bg-primary/40", text: "text-muted-foreground" },
  no_eta: { marker: "bg-muted-foreground/50", text: "text-muted-foreground" },
};

export function useArrivalLabels() {
  const t = useTranslations("stockInTransitPage");
  const locale = useLocale();
  const quantityFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });
  const currentYear = new Date().getFullYear();
  const sameYearFormat = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const otherYearFormat = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const formatArrivalDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return (date.getFullYear() === currentYear ? sameYearFormat : otherYearFormat).format(date);
  };

  const formatRelativeArrival = (daysUntilArrival: number | null) => {
    if (daysUntilArrival === null) return t("notScheduled");
    if (daysUntilArrival < 0) return t("daysLate", { count: Math.abs(daysUntilArrival) });
    if (daysUntilArrival === 0) return t("today");
    return t("inDays", { count: daysUntilArrival });
  };

  const formatQuantityWithUnit = (quantity: number, unit: string) =>
    t("quantityWithUnit", { quantity: quantityFormat.format(quantity), unit });

  const formatOrderedQuantities = (totals: StockInTransitOrderedUnitTotal[]) => {
    const labelCounts = new Map<string, number>();
    for (const { unitName } of totals) {
      labelCounts.set(unitName, (labelCounts.get(unitName) ?? 0) + 1);
    }

    return totals
      .map(({ quantity, unitName, quantityPerUnit }) => {
        const unit =
          (labelCounts.get(unitName) ?? 0) > 1
            ? t("unitWithConversion", {
                unit: unitName,
                quantityPerUnit: quantityFormat.format(quantityPerUnit),
              })
            : unitName;
        return formatQuantityWithUnit(quantity, unit);
      })
      .join(" + ");
  };

  const formatDistinctBaseQuantity = (
    orderedUnitTotals: StockInTransitOrderedUnitTotal[],
    baseQuantity: number,
    baseUnit: string
  ) => {
    const [orderedTotal] = orderedUnitTotals;
    const repeatsOrderedQuantity =
      orderedUnitTotals.length === 1 &&
      orderedTotal?.quantityPerUnit === 1 &&
      orderedTotal.quantity === baseQuantity &&
      orderedTotal.unitName.trim().toLocaleLowerCase() === baseUnit.trim().toLocaleLowerCase();

    return repeatsOrderedQuantity ? null : formatQuantityWithUnit(baseQuantity, baseUnit);
  };

  const arrivalWindowLabels: Record<StockInTransitArrivalWindow, string> = {
    late: t("late"),
    next_7_days: t("next7Days"),
    days_8_to_14: t("days8To14"),
    later: t("later"),
    no_eta: t("noEta"),
  };

  return {
    arrivalWindowLabels,
    formatArrivalDate,
    formatDistinctBaseQuantity,
    formatOrderedQuantities,
    formatRelativeArrival,
  };
}
