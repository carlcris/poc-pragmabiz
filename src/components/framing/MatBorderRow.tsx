"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link2, Unlink2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FractionInput } from "./FractionInput";
import { formatInches } from "@/lib/framing/formatInches";
import { MAT_REVEAL_IN, revealAllowanceIn } from "@/lib/framing/geometry";
import type { MatBorder } from "@/lib/framing/types";

type MatBorderRowProps = {
  border: MatBorder;
  /** How many mats share this border, for the "top mat shows" readout. */
  layerCount: number;
  onChange: (border: MatBorder) => void;
};

/**
 * The mat border, for the whole stack.
 *
 * One control, below the layer list, because that is how the shop cuts: the
 * border is set once and every mat beneath the top takes a fixed quarter inch
 * from *within* it. Adding a mat therefore changes what the frame looks like,
 * never how big it is.
 *
 * L and W are linked by default — an even border is the common cut and typing
 * the same number twice is the common mistake — but can be unlinked for a
 * weighted mat. The link is derived from whether the two are already equal
 * rather than stored, so a reopened 2 × 3 border comes back unlinked without a
 * column for what is really an editing affordance.
 */
export function MatBorderRow({ border, layerCount, onChange }: MatBorderRowProps) {
  const t = useTranslations("framingDialog");
  const [linked, setLinked] = useState(() => border.lengthIn === border.widthIn);

  const setAxis = (axis: "l" | "w", value: number) => {
    if (linked) {
      onChange({ lengthIn: value, widthIn: value });
      return;
    }
    onChange(axis === "l" ? { ...border, lengthIn: value } : { ...border, widthIn: value });
  };

  // Re-linking adopts L for both, rather than silently keeping a W the field no
  // longer shows as separate.
  const toggleLink = () => {
    const next = !linked;
    setLinked(next);
    if (next && border.widthIn !== border.lengthIn) {
      onChange({ ...border, widthIn: border.lengthIn });
    }
  };

  const allowance = revealAllowanceIn(layerCount);
  const topFace = Math.min(border.lengthIn, border.widthIn) - allowance;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
        {t("matBorder")}
      </span>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="mat-border-l" className="text-xs">
            {t("borderL")}
          </Label>
          <FractionInput
            id="mat-border-l"
            className="h-8 font-mono text-sm tabular-nums"
            value={border.lengthIn}
            onCommit={(value) => setAxis("l", value)}
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`mb-0.5 h-8 w-8 shrink-0 ${
            linked ? "text-primary" : "text-muted-foreground"
          }`}
          aria-pressed={linked}
          aria-label={linked ? t("unlinkAxes") : t("linkAxes")}
          title={linked ? t("unlinkAxes") : t("linkAxes")}
          onClick={toggleLink}
        >
          {linked ? <Link2 className="h-4 w-4" /> : <Unlink2 className="h-4 w-4" />}
        </Button>

        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="mat-border-w" className="text-xs">
            {t("borderW")}
          </Label>
          {/* Linked, W mirrors L rather than being separately editable — a field
              that silently rewrites itself reads as a bug. */}
          {linked ? (
            <Input
              id="mat-border-w"
              className="h-8 font-mono text-sm tabular-nums"
              value={border.widthIn ? formatInches(border.widthIn) : ""}
              readOnly
              aria-readonly
            />
          ) : (
            <FractionInput
              id="mat-border-w"
              className="h-8 font-mono text-sm tabular-nums"
              value={border.widthIn}
              onCommit={(value) => setAxis("w", value)}
            />
          )}
        </div>

      </div>

      <p className="text-xs text-muted-foreground">
        {layerCount > 1
          ? t("borderSharedHint", {
              count: layerCount - 1,
              reveal: formatInches(MAT_REVEAL_IN),
              topFace: formatInches(Math.max(0, topFace)),
            })
          : t("borderSingleHint")}
      </p>
    </div>
  );
}
