"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComponentDiscountInput } from "./ComponentDiscountInput";
import { ItemSelect, type ItemSelectOption } from "@/components/common/ItemSelect";
import { formatInches } from "@/lib/framing/formatInches";
import { MAT_REVEAL_IN } from "@/lib/framing/geometry";
import type { MatLayer } from "@/lib/framing/types";

type MatLayerRowProps = {
  layer: MatLayer;
  /** Position in the stack — 0 is the top mat. */
  position: number;
  boardOption: ItemSelectOption | null;
  onBoardSelect: (item: ItemSelectOption) => void;
  onRemove: (() => void) | null;
  /**
   * Whether this line is billed per part. Framing bills one whole-frame figure,
   * so the rate and discount here would move no total and are hidden.
   */
  priced: boolean;
  /** The line's discount map, when this row may edit it. */
  discounts?: Record<string, number>;
  onDiscountsChange?: (discounts: Record<string, number>) => void;
};

/**
 * One mat layer: which board, at what rate.
 *
 * It carries no measurement. The shop sets a single border for the whole stack
 * (the control below the list), and every mat beneath the top reveals a fixed
 * quarter inch taken from *within* that border — so adding a mat changes the
 * look of the frame, never its size.
 *
 * Per-layer border and reveal inputs used to live here. They let an operator
 * enter a reveal that grew the mat outer, which is not how the shop cuts.
 */
export function MatLayerRow({
  layer,
  position,
  boardOption,
  onBoardSelect,
  onRemove,
  priced,
  discounts,
  onDiscountsChange,
}: MatLayerRowProps) {
  const t = useTranslations("framingDialog");
  const isTop = position === 0;

  const positionLabel = isTop
    ? t("topMat")
    : position === 1
      ? t("secondMat")
      : t("thirdMat");

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
          {positionLabel}
        </span>
        {!isTop ? (
          <span className="text-[10px] text-muted-foreground">
            {t("revealsFixed", { reveal: formatInches(MAT_REVEAL_IN) })}
          </span>
        ) : null}
        <span className="flex-1" />
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={t("removeLayer", { position: position + 1 })}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      {/* Board and its discount on one line: the rate is the same across the
          stack and lives with the border, so the only per-layer money question
          is whether this particular mat is marked down. */}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <ItemSelect
            selectedOption={boardOption}
            value={layer.matBoardItemId}
            onItemSelect={onBoardSelect}
            placeholder={t("selectMatBoard")}
          />
        </div>
        {priced && discounts !== undefined && onDiscountsChange ? (
          // Keyed by position, matching the priced component's own key, so a
          // discount follows the layer it was set on.
          <ComponentDiscountInput
            componentKey={`mat-${position}`}
            discounts={discounts}
            onChange={onDiscountsChange}
          />
        ) : null}
      </div>
    </div>
  );
}
