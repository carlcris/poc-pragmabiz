"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FractionInput } from "./FractionInput";
import { ComponentDiscountInput } from "./ComponentDiscountInput";
import { formatInches } from "@/lib/framing/formatInches";
import { formatFraction } from "@/lib/framing/pointFraction";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ItemSelect, type ItemSelectOption } from "@/components/common/ItemSelect";
import { useCurrency } from "@/hooks/useCurrency";
import { useFramingHardware } from "@/hooks/useFramingHardware";
import { ZoomablePreview } from "./ZoomablePreview";
import { GeneratedDocuments } from "./GeneratedDocuments";
import { FrameComponentsDialog } from "./FrameComponentsDialog";
import type { DocumentLabels } from "@/lib/framing/documents";
import { resolveGeometry, mouldingFootage } from "@/lib/framing/geometry";
import { priceLine } from "@/lib/framing/pricing";
import { specSummary } from "@/lib/framing/description";
import { hasMissingFittingItems, matFitsSheet, validateConfiguration } from "@/lib/framing/validation";
import { glazingFallbackLabel, backingLabel } from "@/lib/framing/types";
import { isMouldingRateMissing, resolveMouldingRate } from "@/lib/framing/tiers";
import type { BillingMode, FrameConfiguration, MatBoardSheet } from "@/lib/framing/types";

export type FrameConfigurationResult = {
  config: FrameConfiguration;
  /** Selected items, so the caller can persist item ids and show labels. */
  selections: {
    moulding: ItemSelectOption | null;
    matBoards: Record<number, ItemSelectOption | null>;
    glazing: ItemSelectOption | null;
    backing: ItemSelectOption | null;
  };
};

type FrameConfigurationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billingMode: BillingMode;
  /** Existing configuration when editing; null when adding. */
  initial: FrameConfigurationResult | null;
  onApply: (result: FrameConfigurationResult) => void;
  /** Shown on the generated requisition form; blank until a customer is chosen. */
  customerName?: string;
  customerAddress?: string;
  preparedBy?: string;
};

const DEFAULT_GLASS_RATE = 0.35;
const DEFAULT_BACKING_RATE = 0.16;
/**
 * Rabbet overlap deducted from the artwork on each edge, in inches.
 *
 * Zero by default: the shop sizes a mat opening to the artwork itself, so a
 * 8 × 10 artwork with a 2″ border gives a 12 × 14 mat. The column remains so a
 * line can still be given an overlap where the artwork must not fall through
 * the window, but it is no longer applied unasked.
 */
const DEFAULT_OVERLAP_IN = 0;

function emptyConfig(billingMode: BillingMode): FrameConfiguration {
  return {
    billingMode,
    quantity: 1,
    sizeMode: "artwork",
    enteredLengthIn: 0,
    enteredWidthIn: 0,
    frameWidthIn: 0,
    frameRate: 0,
    overlapIn: DEFAULT_OVERLAP_IN,
    moulding: { itemId: "", code: "", name: "", unitRate: 0, material: null },
    mat: {
      included: false,
      source: "store",
      // No default: the operator must enter the dimensions used for this job.
      border: { lengthIn: 0, widthIn: 0 },
      // No default: the rate is required, and a plausible-looking number the
      // operator never chose is how a line gets quoted at the wrong price.
      unitRate: 0,
      layers: [],
    },
    glazing: {
      included: false,
      glazingType: "clear",
      glazingItemId: null,
      label: glazingFallbackLabel("clear"),
      unitRate: DEFAULT_GLASS_RATE,
      sheets: 1,
      cutToMatOuter: true,
    },
    backing: { backingType: null, backingItemId: null, label: "", unitRate: DEFAULT_BACKING_RATE },
    hardware: {
      // 1/2 is the shop's common cut; the fraction stays as typed because both
      // of its integers price the component.
      flexipoints: {
        included: false,
        fraction: { numerator: 1, denominator: 2 },
        unitRate: 1.5,
        itemId: null,
      },
      multipoints: {
        included: false,
        fraction: { numerator: 1, denominator: 2 },
        unitRate: 8,
        itemId: null,
      },
      lSupport: { included: false, size: "small", unitRate: 32, itemId: null },
    },
    attachments: [],
  };
}

export function FrameConfigurationDialog({
  open,
  onOpenChange,
  billingMode,
  initial,
  onApply,
  customerName,
  customerAddress,
  preparedBy,
}: FrameConfigurationDialogProps) {
  const t = useTranslations("framingDialog");
  const { formatCurrency } = useCurrency();
  const hardware = useFramingHardware();

  const [config, setConfig] = useState<FrameConfiguration>(() => emptyConfig(billingMode));
  const [selections, setSelections] = useState<FrameConfigurationResult["selections"]>({
    moulding: null,
    matBoards: {},
    glazing: null,
    backing: null,
  });

  // Reset the draft each time the dialog opens so a cancelled edit leaves nothing behind.
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setConfig({ ...initial.config, billingMode });
      setSelections(initial.selections);
      return;
    }
    setConfig(emptyConfig(billingMode));
    setSelections({ moulding: null, matBoards: {}, glazing: null, backing: null });
  }, [open, initial, billingMode]);

  const patch = useCallback((changes: Partial<FrameConfiguration>) => {
    setConfig((current) => ({ ...current, ...changes }));
  }, []);

  // Attach the hardware items once they load. Rates come from the item master
  // so a price change there flows through without touching this component.
  useEffect(() => {
    if (!hardware.isReady) return;
    setConfig((current) => {
      const size = current.hardware.lSupport.size;
      const support = hardware.lSupport[size];
      if (
        current.hardware.flexipoints.itemId === hardware.flexipoints?.itemId &&
        current.hardware.multipoints.itemId === hardware.multipoints?.itemId &&
        current.hardware.lSupport.itemId === support?.itemId
      ) {
        return current;
      }
      return {
        ...current,
        hardware: {
          flexipoints: {
            ...current.hardware.flexipoints,
            itemId: hardware.flexipoints?.itemId ?? null,
            unitRate: hardware.flexipoints?.unitRate ?? current.hardware.flexipoints.unitRate,
          },
          multipoints: {
            ...current.hardware.multipoints,
            itemId: hardware.multipoints?.itemId ?? null,
            unitRate: hardware.multipoints?.unitRate ?? current.hardware.multipoints.unitRate,
          },
          lSupport: {
            ...current.hardware.lSupport,
            itemId: support?.itemId ?? null,
            unitRate: support?.unitRate ?? current.hardware.lSupport.unitRate,
          },
        },
      };
    });
  }, [
    hardware,
    config.hardware.lSupport.size,
    config.hardware.flexipoints.itemId,
    config.hardware.multipoints.itemId,
    config.hardware.lSupport.itemId,
  ]);

  const geometry = useMemo(() => resolveGeometry(config), [config]);
  const pricing = useMemo(() => priceLine(config), [config]);
  const errors = useMemo(() => validateConfiguration(config), [config]);

  /** Sheet sizes for the overflow check, from the selected board items' dimensions. */
  const matBoardSheets = useMemo(() => {
    const map = new Map<string, MatBoardSheet>();
    Object.values(selections.matBoards).forEach((option) => {
      if (!option) return;
      map.set(option.id, {
        itemId: option.id,
        label: `${option.code} ${option.name}`,
        // Sheet dimensions are not on the item option; the overflow check is
        // skipped for boards whose sheet size is unknown rather than guessed.
        sheetLengthIn: Number.POSITIVE_INFINITY,
        sheetWidthIn: Number.POSITIVE_INFINITY,
      });
    });
    return map;
  }, [selections.matBoards]);

  const fitWarning = useMemo(
    () => matFitsSheet(config, matBoardSheets),
    [config, matBoardSheets]
  );

  const matColors = useMemo(
    () => config.mat.layers.map(() => "#F2EDDF"),
    [config.mat.layers]
  );

  /** Which component dialog is open; null when none. Each row opens its own. */
  const [componentsSection, setComponentsSection] = useState<
    "matting" | "glazing" | "backing" | null
  >(null);

  /** Label for the matting summary row: "Single mat", "Double mat", … */
  const matLabel = useMemo(() => {
    // Only name a layer count once matting is actually on — "Single mat" beside
    // "No board chosen" claims a configuration that does not exist yet.
    if (!config.mat.included) return t("noMatting");
    const count = config.mat.layers.length;
    if (count === 1) return t("singleMat");
    if (count === 2) return t("doubleMat");
    if (count === 3) return t("tripleMat");
    return t("mattingSection");
  }, [config.mat.included, config.mat.layers.length, t]);

  // Framing bills one figure for the finished frame, so the per-part rate,
  // discount and fitting-hardware controls have nothing to act on and are
  // hidden rather than left live-looking but inert.
  const isChopJoin = config.billingMode === "chop_join";

  /** Right-aligned meta on the backing row — the fitting hardware in shorthand. */
  const hardwareSummary = useMemo(() => {
    const parts: string[] = [];
    const { flexipoints, multipoints, lSupport } = config.hardware;
    // Fractions, matching the job order — the shop reads "×1/2", not "×0.5".
    // Hidden in framing, so it must not appear in the footer summary either.
    if (isChopJoin) {
      if (flexipoints.included) parts.push(`flexi ${formatFraction(flexipoints.fraction)}`);
      if (multipoints.included) parts.push(`multi ${formatFraction(multipoints.fraction)}`);
      if (lSupport.included) parts.push(`L-sup ${lSupport.size}`);
    }
    return parts.join(" · ");
  }, [config.hardware, isChopJoin]);

  /** Item names for the generated documents, resolved from the current picks. */
  const documentLabels = useMemo<DocumentLabels>(() => {
    const matBoards: Record<number, string | undefined> = {};
    Object.entries(selections.matBoards).forEach(([index, option]) => {
      if (option) matBoards[Number(index)] = `${option.code} ${option.name.toLowerCase()}`;
    });
    return {
      moulding: selections.moulding
        ? `${selections.moulding.code} ${selections.moulding.name}`
        : config.moulding.code || "—",
      matBoards,
      glazing: config.glazing.label || selections.glazing?.name,
      backing: selections.backing?.name ?? backingLabel(config.backing),
    };
  }, [selections, config.moulding.code, config.glazing.label, config.backing]);

  // Only a moulding whose tiers we actually have can be judged unpriced. A line
  // reopened for editing restores its moulding from stored columns, which carry
  // no price tiers — treating that as "no rate" would warn on every edit about a
  // moulding that is priced perfectly well.
  const mouldingRateMissing = isMouldingRateMissing(
    selections.moulding?.priceTiers,
    config.billingMode
  );

  // A moulding with no rate for this billing mode prices the whole line at zero,
  // so it blocks Apply rather than only warning.
  /** Dimensions and components stay locked until a moulding is chosen. */
  const mouldingChosen = Boolean(config.moulding.itemId);

  const fittingItemsMissing = hasMissingFittingItems(config);
  const canApply =
    errors.length === 0 && Boolean(config.moulding.itemId) && !mouldingRateMissing &&
    !fittingItemsMissing;

  const handleMouldingSelect = (item: ItemSelectOption) => {
    const rate = resolveMouldingRate(item.priceTiers, config.billingMode);
    setSelections((current) => ({ ...current, moulding: item }));
    patch({
      moulding: {
        itemId: item.id,
        code: item.code,
        name: item.name,
        unitRate: rate ?? 0,
        // Drives which pricing formula applies; null when the item is unclassified.
        material: item.material ?? null,
      },
    });
  };

  // Switching billing mode re-reads the moulding rate from the other tier.
  useEffect(() => {
    // Without tiers there is nothing to re-read. A line reopened for editing
    // restores its rate from the saved component row, and resolving null here
    // would wipe it to zero.
    if (!selections.moulding?.priceTiers?.length) return;
    const rate = resolveMouldingRate(selections.moulding.priceTiers, config.billingMode);
    setConfig((current) =>
      current.moulding.unitRate === (rate ?? 0)
        ? current
        : { ...current, moulding: { ...current.moulding, unitRate: rate ?? 0 } }
    );
  }, [config.billingMode, selections.moulding]);

  const handleApply = () => {
    if (!canApply) return;
    onApply({ config, selections });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-3rem)] w-[calc(100vw-3rem)] max-w-[1440px] overflow-hidden p-0"
        /* A frame configuration is long-form work; a stray click on the
           backdrop must not discard it. Closing is deliberate only: the X, or
           Cancel. Escape is left alone as the standard accessible exit. */
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {initial ? t("editTitle") : t("addTitle")}
          </DialogTitle>
          <DialogDescription>
            {config.billingMode === "chop_join" ? t("chopJoinLede") : t("framingLede")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[72vh] grid-cols-1 overflow-hidden xl:grid-cols-[minmax(520px,0.95fr)_minmax(560px,1.05fr)]">
          {/* ---------------- form ---------------- */}
          <div className="space-y-5 overflow-y-auto px-6 py-6">
            {/* frame & artwork */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("frameSection")}
              </h3>

              <div className="flex flex-col gap-1.5">
                <Label>{t("moulding")}</Label>
                <ItemSelect
                  selectedOption={selections.moulding}
                  value={config.moulding.itemId}
                  onItemSelect={handleMouldingSelect}
                  placeholder={t("selectMoulding")}
                  // Flag unpriced mouldings in the list, so the problem is seen
                  // while choosing rather than reported after the fact.
                  renderTrailing={(item) =>
                    resolveMouldingRate(item.priceTiers, config.billingMode) === null ? (
                      <span className="text-xs font-medium text-destructive">
                        {t("noRateForMode")}
                      </span>
                    ) : null
                  }
                />
                {mouldingRateMissing ? (
                  <Alert variant="destructive" className="mt-1 py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {t("mouldingRateMissing", {
                        mode:
                          config.billingMode === "chop_join"
                            ? t("chopJoinMode")
                            : t("framingMode"),
                      })}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>

              {!mouldingChosen ? (
                <p className="text-xs text-muted-foreground">{t("chooseMouldingFirst")}</p>
              ) : null}

              {/* Dimensions wait on the moulding. Sizing a frame whose material
                  is not chosen produces a priced line with nothing to cut, and
                  the moulding's own width is a dimension in its own right — the
                  geometry cannot resolve until it is known. */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex w-24 flex-col gap-1.5">
                  <Label htmlFor="frame-length">{t("length")}</Label>
                  <FractionInput
                    id="frame-length"
                    className="font-mono tabular-nums"
                    disabled={!mouldingChosen}
                    value={config.enteredLengthIn}
                    onCommit={(enteredLengthIn) => patch({ enteredLengthIn })}
                  />
                </div>
                <div className="flex w-24 flex-col gap-1.5">
                  <Label htmlFor="frame-width-dim">{t("width")}</Label>
                  <FractionInput
                    id="frame-width-dim"
                    className="font-mono tabular-nums"
                    disabled={!mouldingChosen}
                    value={config.enteredWidthIn}
                    onCommit={(enteredWidthIn) => patch({ enteredWidthIn })}
                  />
                </div>
                <div className="flex w-28 flex-col gap-1.5">
                  <Label htmlFor="frame-moulding-width">{t("frameWidth")}</Label>
                  <FractionInput
                    id="frame-moulding-width"
                    className="font-mono tabular-nums"
                    disabled={!mouldingChosen}
                    value={config.frameWidthIn}
                    onCommit={(frameWidthIn) => patch({ frameWidthIn })}
                  />
                </div>
                {/* The moulding has no components dialog of its own — its rate
                    comes from the price tier — so its discount belongs here,
                    beside the dimensions it is priced from. Framing bills one
                    figure for the whole frame, so there is no component to
                    discount and the field would do nothing. */}
                {isChopJoin ? (
                  <ComponentDiscountInput
                    componentKey="moulding"
                    size="default"
                    discounts={config.componentDiscounts}
                    onChange={(componentDiscounts) => patch({ componentDiscounts })}
                  />
                ) : (
                  <div className="flex w-28 flex-col gap-1.5">
                    <Label htmlFor="frame-rate">{t("frameRate")}</Label>
                    <Input
                      id="frame-rate"
                      className="text-right font-mono tabular-nums"
                      inputMode="decimal"
                      disabled={!mouldingChosen}
                      value={config.frameRate || ""}
                      placeholder="0"
                      onChange={(event) =>
                        patch({ frameRate: Number(event.target.value) || 0 })
                      }
                    />
                  </div>
                )}

                <div className="flex w-20 flex-col gap-1.5">
                  <Label htmlFor="frame-qty">{t("quantity")}</Label>
                  <Input
                    id="frame-qty"
                    className="font-mono tabular-nums"
                    inputMode="numeric"
                    disabled={!mouldingChosen}
                    value={config.quantity}
                    onChange={(event) => patch({ quantity: Number(event.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={config.sizeMode === "artwork" ? "secondary" : "ghost"}
                  onClick={() => patch({ sizeMode: "artwork" })}
                >
                  {t("sizeModeArtwork")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={config.sizeMode === "outside" ? "secondary" : "ghost"}
                  onClick={() => patch({ sizeMode: "outside" })}
                >
                  {t("sizeModeOutside")}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {config.sizeMode === "artwork" ? t("sizeModeArtworkHint") : t("sizeModeOutsideHint")}
                </span>
              </div>

              {/* Derived sizes sit with the fields that produce them. */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Readout
                  label={t("matOuter")}
                  value={
                    geometry.matOuter
                      ? `${formatInches(geometry.matOuter.lengthIn)}″ × ${formatInches(geometry.matOuter.widthIn)}″`
                      : "—"
                  }
                />
                <Readout
                  label={t("frameOutside")}
                  value={`${formatInches(geometry.outside.lengthIn)}″ × ${formatInches(geometry.outside.widthIn)}″`}
                />
                {/* Stock to pull, not the pricing basis — see mouldingCharge. */}
                <Readout
                  label={t("footage")}
                  hint={t("stockHint")}
                  value={`${mouldingFootage(geometry.outside).toFixed(1)} ft`}
                />
              </div>
            </section>

            {/* components — each row opens its own dialog from its ⋯ */}
            <section className="space-y-2 border-t pt-4">
              <div className="overflow-hidden rounded-lg border">
                <SummaryRow
                  swatch={config.mat.included ? (matColors[0] ?? "#F2EDDF") : undefined}
                  label={matLabel}
                  value={
                    config.mat.included
                      ? selections.matBoards[0]
                        ? `${selections.matBoards[0]?.code} ${selections.matBoards[0]?.name}`
                        : t("noBoardChosen")
                      : "—"
                  }
                  meta={
                    config.mat.included && config.mat.layers.length > 0
                      ? `${t("border")} ${formatInches(config.mat.border.lengthIn)}″`
                      : ""
                  }
                  actionLabel={t("configureSection", { section: t("mattingSection") })}
                  disabled={!mouldingChosen}
                  onConfigure={() => setComponentsSection("matting")}
                />
                <SummaryRow
                  swatch={config.glazing.included ? "#DCE9F0" : undefined}
                  label={t("glazingSection")}
                  value={
                    config.glazing.included
                      ? config.glazing.label || t("noneChosen")
                      : t("noGlazing")
                  }
                  meta={
                    config.glazing.included
                      ? `${config.glazing.sheets} ${t("sheetsLabel")}`
                      : ""
                  }
                  actionLabel={t("configureSection", { section: t("glazingSection") })}
                  disabled={!mouldingChosen}
                  onConfigure={() => setComponentsSection("glazing")}
                />
                <SummaryRow
                  swatch={config.backing.backingType ? "#C9A87C" : undefined}
                  label={t("backingSection")}
                  value={config.backing.label || t("noneChosen")}
                  meta={hardwareSummary}
                  actionLabel={t("configureSection", { section: t("backingSection") })}
                  disabled={!mouldingChosen}
                  onConfigure={() => setComponentsSection("backing")}
                  last
                />
                {/* Attachments used to sit here as a fourth row. They now live
                    in the document panel's own tab, where the files are visible
                    rather than counted, and can be uploaded in place. */}
              </div>
              {/* The spec summary lives only in the footer, where it stays
                  pinned while the form scrolls. Repeating it directly under the
                  component rows restated what those rows already show. */}

              {/* Both modes: a chop & join order still carries direction the
                  bench needs ("cut long, customer collects"). Optional, and kept
                  visible rather than behind a dialog — a "canvas torn top-left"
                  note is exactly what must not be hunted for. */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="framing-instructions" className="text-xs">
                  {t("additionalInstructions")}
                </Label>
                <Textarea
                  id="framing-instructions"
                  rows={3}
                  className="resize-none text-sm"
                  value={config.framingInstructions ?? ""}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      framingInstructions: event.target.value,
                    }))
                  }
                />
              </div>
            </section>
          </div>

          {/* ---------------- live preview ---------------- */}
          <aside className="space-y-4 overflow-y-auto border-t bg-muted/40 px-6 py-6 xl:border-l xl:border-t-0">
            <ZoomablePreview config={config} matColors={matColors} size={190} />

            {fitWarning ? (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{fitWarning}</AlertDescription>
              </Alert>
            ) : null}

            {/* the paper the shop actually works from */}
            <GeneratedDocuments
              config={config}
              onAttachmentsChange={(attachments) =>
                setConfig((current) => ({ ...current, attachments }))
              }
              labels={documentLabels}
              totalSales={formatCurrency(pricing.total)}
              fitWarning={fitWarning}
              customerName={customerName}
              customerAddress={customerAddress}
              preparedBy={preparedBy}
            />
          </aside>
        </div>

        <DialogFooter className="border-t px-6 py-3">
          <span className="mr-auto truncate font-mono text-xs text-muted-foreground">
            {specSummary(config)}
          </span>
          {errors.length > 0 ? (
            <span className="text-xs text-destructive">{errors[0]}</span>
          ) : null}
          {fittingItemsMissing ? (
            <span className="text-xs text-destructive">{t("fittingItemsMissing")}</span>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={handleApply} disabled={!canApply}>
            <Check className="mr-1 h-4 w-4" />
            {initial ? t("saveChanges") : t("addToQuotation")}
          </Button>
        </DialogFooter>
      </DialogContent>

      <FrameComponentsDialog
        open={componentsSection !== null}
        onOpenChange={(next) => {
          if (!next) setComponentsSection(null);
        }}
        section={componentsSection ?? "matting"}
        config={config}
        selections={selections}
        hardware={hardware}
        matColors={matColors}
        onApply={(nextConfig, nextSelections) => {
          setConfig(nextConfig);
          setSelections(nextSelections);
          setComponentsSection(null);
        }}
      />

    </Dialog>
  );
}

/**
 * A derived measurement shown beside the fields that produce it. Tinted rather
 * than bordered so it reads as output, not another input to fill in.
 */
function Readout({ label, hint, value }: { label: string; hint?: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {hint ? <span className="ml-1.5 text-[10px] font-normal opacity-70">{hint}</span> : null}
      </span>
      <span className="flex h-9 items-center truncate rounded-md border border-primary/20 bg-primary/5 px-3 font-mono text-[13px] font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

/**
 * One row of the components summary. The trailing ⋯ opens that component's own
 * dialog — each component is configured on its own, not in one combined form.
 */
function SummaryRow({
  swatch,
  label,
  value,
  meta,
  actionLabel,
  onConfigure,
  last,
  disabled,
}: {
  swatch?: string;
  label: string;
  value: string;
  meta?: string;
  actionLabel: string;
  onConfigure: () => void;
  last?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5", !last && "border-b")}>
      <span
        className="h-4 w-4 shrink-0 rounded border"
        style={swatch ? { background: swatch } : undefined}
        aria-hidden
      />
      <span className="w-24 shrink-0 text-sm font-semibold">{label}</span>
      <span className="flex-1 truncate text-sm text-muted-foreground">{value}</span>
      {meta ? (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{meta}</span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground"
        aria-label={actionLabel}
        title={actionLabel}
        disabled={disabled}
        onClick={onConfigure}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}
