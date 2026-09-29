"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ComponentDiscountInputProps = {
  /** The component's own key — "moulding", "mat-0", "glazing", "backing". */
  componentKey: string;
  discounts: Record<string, number> | undefined;
  onChange: (discounts: Record<string, number>) => void;
  /**
   * Match the row this sits in. The component dialogs use compact fields;
   * the configuration dialog's header row is full height.
   */
  size?: "sm" | "default";
};

/**
 * Discount rate for one component.
 *
 * The shop discounts individual parts, not whole lines — a wood moulding at 20%
 * while the mat and glass on the same frame carry none — so the field sits
 * beside each part's rate rather than once on the line.
 *
 * A zero is stored as an absent key rather than `0`, so an untouched frame
 * saves no discount map at all and reads back identically to one saved before
 * this existed.
 */
export function ComponentDiscountInput({
  componentKey,
  discounts,
  onChange,
  size = "sm",
}: ComponentDiscountInputProps) {
  const t = useTranslations("framingDialog");
  const value = discounts?.[componentKey] ?? 0;

  return (
    <div className="flex w-24 flex-col gap-1.5">
      <Label
        htmlFor={`discount-${componentKey}`}
        className={size === "sm" ? "text-xs" : undefined}
      >
        {t("discountRate")}
      </Label>
      <Input
        id={`discount-${componentKey}`}
        className={cn(
          "text-right font-mono tabular-nums",
          size === "sm" && "h-8 text-sm"
        )}
        inputMode="decimal"
        value={value || ""}
        placeholder="0"
        onChange={(event) => {
          const next = { ...(discounts ?? {}) };
          // Clamped here as well as in pricing: the field should not let an
          // operator type a rate that silently means something else.
          const rate = Math.min(100, Math.max(0, Number(event.target.value) || 0));
          if (rate > 0) {
            next[componentKey] = rate;
          } else {
            delete next[componentKey];
          }
          onChange(next);
        }}
      />
    </div>
  );
}
