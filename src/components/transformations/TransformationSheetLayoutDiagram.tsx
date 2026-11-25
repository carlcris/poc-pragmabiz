"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { SheetLayoutSection } from "@/types/transformation-template";
import { cn } from "@/lib/utils";

type TransformationSheetLayoutDiagramProps = {
  sheetWidth: number;
  sheetHeight: number;
  sheetUnit: string;
  sections: SheetLayoutSection[];
  /** Pieces whose output item sorts at an odd position get the alternate tint. */
  alternateItemIds: ReadonlySet<string>;
  isSectionHighlighted: (section: SheetLayoutSection) => boolean;
  selectedSectionId: string | null;
  onSectionSelect: (section: SheetLayoutSection) => void;
};

// Labels only render where a piece is large enough to hold them at the
// diagram's typical rendered width, so small offcuts stay legible blocks.
const LABEL_MIN_FRACTION = { width: 0.06, height: 0.04 };
const SIZE_MIN_FRACTION = { width: 0.15, height: 0.08 };

export function TransformationSheetLayoutDiagram({
  sheetWidth,
  sheetHeight,
  sheetUnit,
  sections,
  alternateItemIds,
  isSectionHighlighted,
  selectedSectionId,
  onSectionSelect,
}: TransformationSheetLayoutDiagramProps) {
  const t = useTranslations("transformationTemplateDetail");
  const format = useFormatter();
  const formatValue = (value: number) => format.number(value, { maximumFractionDigits: 2 });

  return (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: `calc(56vh * ${sheetWidth / sheetHeight})` }}
    >
      <p className="mb-1 text-center text-xs font-medium tabular-nums text-muted-foreground">
        {t("dimensionValue", { value: formatValue(sheetWidth), unit: sheetUnit })}
      </p>
      <div className="flex items-stretch gap-2">
        <p className="flex rotate-180 items-center justify-center text-xs font-medium tabular-nums text-muted-foreground [writing-mode:vertical-rl]">
          {t("dimensionValue", { value: formatValue(sheetHeight), unit: sheetUnit })}
        </p>
        <div
          className="relative w-full bg-background outline outline-2 outline-foreground"
          style={{ aspectRatio: `${sheetWidth} / ${sheetHeight}` }}
        >
          {sections.map((section) => {
            const widthFraction = section.width / sheetWidth;
            const heightFraction = section.height / sheetHeight;
            const showLabel =
              widthFraction >= LABEL_MIN_FRACTION.width &&
              heightFraction >= LABEL_MIN_FRACTION.height;
            const showSize =
              widthFraction >= SIZE_MIN_FRACTION.width &&
              heightFraction >= SIZE_MIN_FRACTION.height;
            const isLeftover = section.type === "leftover";
            const isHighlighted = isSectionHighlighted(section);
            const sizeText = t("cutSizeValue", {
              width: formatValue(section.width),
              height: formatValue(section.height),
              unit: sheetUnit,
            });
            const accessibleName = isLeftover
              ? t("leftoverButtonLabel", { label: section.label, size: sizeText })
              : section.mappedItem
                ? t("pieceButtonLabel", {
                    label: section.label,
                    size: sizeText,
                    item: section.mappedItem.itemCode,
                  })
                : t("unmappedPieceButtonLabel", { label: section.label, size: sizeText });

            return (
              <button
                key={section.id}
                type="button"
                aria-label={accessibleName}
                aria-pressed={selectedSectionId === section.id}
                onClick={() => onSectionSelect(section)}
                className={cn(
                  "absolute flex flex-col items-center justify-center gap-0.5 overflow-hidden text-foreground transition-colors focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  isHighlighted
                    ? "z-10 border-2 border-primary bg-secondary"
                    : isLeftover
                      ? "border border-dashed border-muted-foreground/50 bg-background hover:bg-muted/60"
                      : cn(
                          "border border-muted-foreground/40 hover:bg-secondary/60",
                          section.mappedItem && alternateItemIds.has(section.mappedItem.itemId)
                            ? "bg-muted"
                            : "bg-background"
                        )
                )}
                style={{
                  left: `${(section.x / sheetWidth) * 100}%`,
                  top: `${(section.y / sheetHeight) * 100}%`,
                  width: `${widthFraction * 100}%`,
                  height: `${heightFraction * 100}%`,
                }}
              >
                {showLabel && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "text-xs font-semibold sm:text-sm",
                      isLeftover && "font-medium text-muted-foreground"
                    )}
                  >
                    {isLeftover ? t("leftover") : section.label}
                  </span>
                )}
                {showSize && (
                  <span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">
                    {sizeText}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
