"use client";

/**
 * A configured line holds several sizes — an 8 × 10 and a 12 × 10 of the same
 * job — each with its own moulding, mat, glass and backing. This dialog lists
 * them; the configuration itself is edited in `FrameConfigurationDialog`,
 * opened by **Add size** or a row's edit button.
 *
 * The right pane splits by scope: the preview and readouts follow the selected
 * size, while the requisition below stays whole, because it is the document for
 * the entire job.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrency } from "@/hooks/useCurrency";
import { FramePreviewPlaceholder } from "./FramePreview";
import { ZoomablePreview } from "./ZoomablePreview";
import { GeneratedDocuments } from "./GeneratedDocuments";
import {
  FrameConfigurationDialog,
  type FrameConfigurationResult,
} from "./FrameConfigurationDialog";
import { resolveGeometry } from "@/lib/framing/geometry";
import { priceLine } from "@/lib/framing/pricing";
import { specSummary } from "@/lib/framing/description";
import { formatInches } from "@/lib/framing/formatInches";
import type { DocumentLabels } from "@/lib/framing/documents";
import { backingLabel } from "@/lib/framing/types";
import type { BillingMode } from "@/lib/framing/types";

type FrameSizesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billingMode: BillingMode;
  /** Existing sizes when editing; empty when adding. */
  initial: FrameConfigurationResult[];
  /**
   * Whether this dialog is creating a line or editing one already on the
   * quotation. Only the footer label depends on it — "Add to quotation" on a
   * line that is already there reads as though it would add a second one.
   */
  mode?: "add" | "edit";
  /** Whole-job custody record, edited on the Items received tab. */
  itemsReceived?: string;
  onItemsReceivedChange?: (value: string) => void;
  /** A saved line's discount, so reopening does not silently reset it. */
  initialDiscount?: number;
  onApply: (sizes: FrameConfigurationResult[], discountAmount: number) => void;
  customerName?: string;
  customerAddress?: string;
  preparedBy?: string;
};

export function FrameSizesDialog({
  open,
  onOpenChange,
  billingMode,
  initial,
  mode = "add",
  itemsReceived,
  onItemsReceivedChange,
  initialDiscount = 0,
  onApply,
  customerName,
  customerAddress,
  preparedBy,
}: FrameSizesDialogProps) {
  const t = useTranslations("framingDialog");
  const ts = useTranslations("frameSizesDialog");
  const { formatCurrency } = useCurrency();

  const [sizes, setSizes] = useState<FrameConfigurationResult[]>(initial);
  const [selected, setSelected] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(initialDiscount);
  /** Index being edited, `"new"` while adding, null when the editor is closed. */
  const [editing, setEditing] = useState<number | "new" | null>(null);

  // Re-seed each time the dialog opens so a cancelled edit leaves nothing behind.
  useEffect(() => {
    if (!open) return;
    setSizes(initial);
    setSelected(0);
    // Reset with the rest: `useState(initialDiscount)` only reads the first
    // render, so a second line opened after the first would keep its discount.
    setDiscountAmount(initialDiscount);
    // The size list is what opens. Auto-opening the editor on an empty list hid
    // it entirely behind a full-screen dialog — the user saw only the per-size
    // form and no way to tell a line can hold several sizes.
    setEditing(null);
  }, [open, initial, initialDiscount]);

  const selectedSize = sizes[selected] ?? sizes[0] ?? null;

  const totals = useMemo(() => sizes.map((size) => priceLine(size.config).total), [sizes]);
  const grossTotal = useMemo(
    () => Math.round(totals.reduce((sum, total) => sum + total, 0) * 100) / 100,
    [totals]
  );
  // Clamped to the job's worth: a discount larger than the total would credit
  // the customer for taking the frames away.
  const lineTotal = Math.max(0, Math.round((grossTotal - discountAmount) * 100) / 100);

  /** Item names per size, so the requisition can print the whole job. */
  const documentSizes = useMemo(
    () =>
      sizes.map((size) => {
        const matBoards: Record<number, string | undefined> = {};
        Object.entries(size.selections.matBoards).forEach(([index, option]) => {
          if (option) matBoards[Number(index)] = `${option.code} ${option.name.toLowerCase()}`;
        });
        return {
          config: size.config,
          labels: {
            moulding: size.selections.moulding
              ? `${size.selections.moulding.code} ${size.selections.moulding.name}`
              : size.config.moulding.code || "—",
            matBoards,
            glazing: size.config.glazing.label,
            backing: backingLabel(size.config.backing),
          } satisfies DocumentLabels,
        };
      }),
    [sizes]
  );

  const applySize = (result: FrameConfigurationResult) => {
    setSizes((current) => {
      if (editing === "new" || editing === null) {
        setSelected(current.length);
        return [...current, result];
      }
      setSelected(editing);
      return current.map((size, index) => (index === editing ? result : size));
    });
    setEditing(null);
  };

  const removeSize = (index: number) => {
    setSizes((current) => current.filter((_, position) => position !== index));
    setSelected((current) => (current >= index && current > 0 ? current - 1 : current));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100vh-3rem)] w-[calc(100vw-3rem)] max-w-[1440px] overflow-hidden p-0"
        /* A frame configuration is long-form work; a stray click on the
           backdrop must not discard it. Closing is deliberate only: the X, or
           Cancel. Escape is left alone as the standard accessible exit. */
        onInteractOutside={(event) => event.preventDefault()}
      >
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>
              {billingMode === "chop_join" ? t("chopJoinMode") : t("framingMode")}
            </DialogTitle>
            <DialogDescription>
              {billingMode === "chop_join" ? t("chopJoinLede") : t("framingLede")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid h-[72vh] grid-cols-1 overflow-hidden xl:grid-cols-[minmax(520px,0.95fr)_minmax(560px,1.05fr)]">
            {/* ---------------- sizes ---------------- */}
            <div className="space-y-3 overflow-y-auto px-6 py-6">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {ts("sizes")}
                </h3>
                <span className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing("new")}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {ts("addSize")}
                </Button>
              </div>

              {sizes.length === 0 ? (
                /* A ghost of the real row rather than a dashed box: same
                   border, same column rhythm, same monospace dimension slot, so
                   it reads as the table about to be filled. The row is itself
                   the target — the header already has an Add size button, and a
                   second one 250px below it was the duplication that made this
                   look unconsidered. */
                <div className="overflow-hidden rounded-lg border">
                  <button
                    type="button"
                    onClick={() => setEditing("new")}
                    /* h-12 matches a populated row, whose icon buttons make it
                       taller than padding alone — otherwise the list jumps 8px
                       the moment the first size lands. */
                    className="group flex h-12 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none"
                  >
                    <span className="flex w-28 shrink-0 items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-muted-foreground/50">
                      <Plus className="h-3.5 w-3.5 transition-colors group-hover:text-primary" />
                      {ts("ghostDimensions")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {ts("noSizes")}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground/40">
                      {formatCurrency(0)}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  {sizes.map((size, index) => {
                    const geometry = resolveGeometry(size.config);
                    const isSelected = index === selected;
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-3 px-3 py-2.5 ${
                          index < sizes.length - 1 ? "border-b" : ""
                        } ${isSelected ? "bg-primary/5" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelected(index)}
                          aria-pressed={isSelected}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className="w-28 shrink-0 font-mono text-sm font-semibold tabular-nums">
                            {formatInches(geometry.artwork.lengthIn)}″ ×{" "}
                            {formatInches(geometry.artwork.widthIn)}″
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {specSummary(size.config)}
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums">
                            {formatCurrency(totals[index] ?? 0)}
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground"
                          aria-label={ts("configureSize")}
                          title={ts("configureSize")}
                          onClick={() => setEditing(index)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          aria-label={ts("removeSize")}
                          title={ts("removeSize")}
                          onClick={() => removeSize(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* A receipt, so it is shaped like one: the figures share a right
                  edge and read down to the total, with the rule above the total
                  doing the summing. The discount input sits in that column too,
                  so what the operator types lines up under what it affects. */}
              {sizes.length > 0 ? (
                <dl className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">{ts("beforeDiscount")}</dt>
                    <dd className="font-mono tabular-nums">{formatCurrency(grossTotal)}</dd>
                  </div>

                  {/* One discount for the whole job — not per size, and not per
                      frame. A fixed sum, so it survives a change of quantity. */}
                  <div className="flex items-center justify-between gap-4">
                    <dt>
                      <Label htmlFor="line-discount" className="font-normal text-muted-foreground">
                        {ts("discountAmount")}
                      </Label>
                    </dt>
                    <dd className="flex items-center gap-1">
                      <span
                        aria-hidden
                        className={`font-mono text-sm ${
                          discountAmount > 0 ? "text-foreground" : "text-transparent"
                        }`}
                      >
                        −
                      </span>
                      <Input
                        id="line-discount"
                        className="h-8 w-28 text-right font-mono text-sm tabular-nums"
                        inputMode="decimal"
                        value={discountAmount || ""}
                        placeholder="0.00"
                        onChange={(event) =>
                          setDiscountAmount(Math.max(0, Number(event.target.value) || 0))
                        }
                      />
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between gap-4 border-t pt-2">
                    <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {ts("lineTotal")}
                    </dt>
                    <dd className="font-mono text-base font-semibold tabular-nums">
                      {formatCurrency(lineTotal)}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>

            {/* ---------------- preview follows the selection ---------------- */}
            {/* The pane always shows the same two things — a preview and the
                requisition — so an empty line renders their blank forms rather
                than a sentence. The panel then keeps its shape as sizes are
                added, instead of appearing from nothing. */}
            <aside className="space-y-4 overflow-y-auto border-t bg-muted/40 px-6 py-6 xl:border-l xl:border-t-0">
              {/* Only a real preview is zoomable — the placeholder has nothing
                  to enlarge, so it keeps its own plain container. */}
              {selectedSize ? (
                <ZoomablePreview
                  config={selectedSize.config}
                  matColors={selectedSize.config.mat.layers.map(() => "#F2EDDF")}
                  size={190}
                />
              ) : (
                <div className="grid place-items-center rounded-lg border bg-background p-4">
                  <div className="grid place-items-center gap-2">
                    <FramePreviewPlaceholder size={190} />
                    <p className="text-xs text-muted-foreground">{ts("previewPending")}</p>
                  </div>
                </div>
              )}

              {/* The requisition covers the whole job, so it does not follow the
                  selection — every size prints on it. */}
              <GeneratedDocuments
                config={selectedSize?.config}
                labels={documentSizes[selected]?.labels ?? documentSizes[0]?.labels}
                sizes={documentSizes}
                totalSales={formatCurrency(lineTotal)}
                fitWarning={null}
                customerName={customerName}
                customerAddress={customerAddress}
                preparedBy={preparedBy}
                itemsReceived={itemsReceived}
                onItemsReceivedChange={onItemsReceivedChange}
                /* Files belong to the selected size, so uploading here writes
                   back into that size rather than the line. */
                onAttachmentsChange={
                  selectedSize
                    ? (attachments) =>
                        setSizes((current) =>
                          current.map((size, index) =>
                            index === selected
                              ? { ...size, config: { ...size.config, attachments } }
                              : size
                          )
                        )
                    : undefined
                }
                billingMode={billingMode}
              />
            </aside>
          </div>

          <DialogFooter className="border-t px-6 py-3">
            <span className="mr-auto truncate font-mono text-xs text-muted-foreground">
              {ts("sizeCount", { count: sizes.length })}
            </span>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button disabled={sizes.length === 0} onClick={() => onApply(sizes, discountAmount)}>
              {mode === "edit" ? t("saveToQuotation") : t("addToQuotation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* A sibling, not a child: nested inside the parent Dialog it belongs to
          that dialog's tree and renders over it rather than stacking on top. */}
      <FrameConfigurationDialog
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        billingMode={billingMode}
        initial={typeof editing === "number" ? (sizes[editing] ?? null) : null}
        onApply={applySize}
        customerName={customerName}
        customerAddress={customerAddress}
        preparedBy={preparedBy}
      />
    </>
  );
}
