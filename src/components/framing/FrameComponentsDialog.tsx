"use client";

/**
 * The "Frame components" dialog from `docs/prototypes/chop-and-join-final.html`.
 *
 * Matting, glass, and backing live here rather than on the main configuration
 * form: they are three deep sub-configurations, and inline they buried the glass
 * and backing controls far enough down the form that they were easy to miss.
 *
 * The prototype's draft-and-apply behaviour is preserved — edits are held in a
 * local draft and only reach the frame on Apply, so Cancel discards component
 * changes without touching the geometry the user already entered.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FractionInput } from "./FractionInput";
import { PointFractionInput } from "./PointFractionInput";
import { ComponentDiscountInput } from "./ComponentDiscountInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemSelectOption } from "@/components/common/ItemSelect";
import { useCurrency } from "@/hooks/useCurrency";
import { useFramingMaterials } from "@/hooks/useFramingMaterials";
import type { useFramingHardware } from "@/hooks/useFramingHardware";
import { ZoomablePreview } from "./ZoomablePreview";
import { MatLayerRow } from "./MatLayerRow";
import { MatBorderRow } from "./MatBorderRow";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { resolveGeometry } from "@/lib/framing/geometry";
import { priceLine } from "@/lib/framing/pricing";
import { specSummary } from "@/lib/framing/description";
import {
  matFitsSheet,
  matStackFitsBorder,
  MAX_MAT_LAYERS,
  validateMatting,
} from "@/lib/framing/validation";
import {
  BACKING_TYPES,
  GLAZING_TYPES,
  glazingSheetsEditable,
  type FrameConfiguration,
  type MatBoardSheet,
  type MatLayer,
} from "@/lib/framing/types";


/** Glass is cheaper below 15 inches on both edges — a pre-fill, always overridable. */
const suggestedGlassRate = (lengthIn: number, widthIn: number) =>
  lengthIn < 15 && widthIn < 15 ? 0.25 : 0.35;

type Selections = {
  moulding: ItemSelectOption | null;
  matBoards: Record<number, ItemSelectOption | null>;
  glazing: ItemSelectOption | null;
  backing: ItemSelectOption | null;
};

type FrameComponentsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: FrameConfiguration;
  selections: Selections;
  hardware: ReturnType<typeof useFramingHardware>;
  matColors: string[];
  /** Which component this dialog edits. Each summary row opens its own. */
  section: SectionKey;
  onApply: (config: FrameConfiguration, selections: Selections) => void;
};

type SectionKey = "matting" | "glazing" | "backing";

export function FrameComponentsDialog({
  open,
  onOpenChange,
  config,
  selections,
  hardware,
  matColors,
  section,
  onApply,
}: FrameComponentsDialogProps) {
  const t = useTranslations("framingDialog");
  const tc = useTranslations("frameComponentsDialog");
  const { formatCurrency } = useCurrency();
  const materials = useFramingMaterials();

  const [draft, setDraft] = useState<FrameConfiguration>(config);
  const [draftSelections, setDraftSelections] = useState<Selections>(selections);

  // Re-seed the draft each time the dialog opens so a cancelled edit leaves nothing behind.
  useEffect(() => {
    if (!open) return;
    setDraftSelections(selections);

    // Opening a component's dialog *is* the act of including it — there is no
    // "include" checkbox to tick. Matting seeds a single mat so the dialog opens
    // on something to edit; glazing takes its suggested rate for the size.
    setDraft(() => {
      if (section === "matting" && !config.mat.included) {
        return {
          ...config,
          mat: {
            ...config.mat,
            included: true,
            layers:
              config.mat.layers.length > 0
                ? config.mat.layers
                : [{ layerIndex: 0, matBoardItemId: "" }],
          },
        };
      }
      if (section === "glazing" && !config.glazing.included) {
        const size = resolveGeometry(config).sight;
        return {
          ...config,
          glazing: {
            ...config.glazing,
            included: true,
            unitRate: suggestedGlassRate(size.lengthIn, size.widthIn),
          },
        };
      }
      return config;
    });
  }, [open, config, selections, section]);

  // Backfill the item ids once the catalogue loads. A configuration opened
  // before the items resolve would otherwise keep nulls and lose its glass and
  // backing rows on save.
  useEffect(() => {
    if (!materials.isReady) return;
    setDraft((current) => {
      const glazingItemId = materials.glazingItemId(current.glazing.glazingType);
      const backingItemId = current.backing.backingType
        ? materials.backingItemId(current.backing.backingType)
        : null;
      if (
        current.glazing.glazingItemId === glazingItemId &&
        current.backing.backingItemId === backingItemId
      ) {
        return current;
      }
      return {
        ...current,
        glazing: { ...current.glazing, glazingItemId },
        backing: { ...current.backing, backingItemId },
      };
    });
  }, [materials]);

  const geometry = useMemo(() => resolveGeometry(draft), [draft]);

  /**
   * Only the errors this dialog can fix. The full `validateConfiguration` covers
   * dimensions the parent owns, and blocking Apply on those would strand the
   * operator on a screen where they cannot be corrected.
   */
  const draftErrors = useMemo(() => validateMatting(draft), [draft]);
  const pricing = useMemo(() => priceLine(draft), [draft]);

  const matBoardSheets = useMemo(() => {
    const map = new Map<string, MatBoardSheet>();
    Object.values(draftSelections.matBoards).forEach((option) => {
      if (!option) return;
      map.set(option.id, {
        itemId: option.id,
        label: `${option.code} ${option.name}`,
        sheetLengthIn: Number.POSITIVE_INFINITY,
        sheetWidthIn: Number.POSITIVE_INFINITY,
      });
    });
    return map;
  }, [draftSelections.matBoards]);

  const fitWarning = useMemo(
    () => matFitsSheet(draft, matBoardSheets),
    [draft, matBoardSheets]
  );

  const updateLayer = (index: number, changes: Partial<MatLayer>) => {
    setDraft((current) => ({
      ...current,
      mat: {
        ...current.mat,
        layers: current.mat.layers.map((layer, position) =>
          position === index ? { ...layer, ...changes } : layer
        ),
      },
    }));
  };

  // A mat can only be added while the border can still absorb another reveal
  // and leave the top mat a visible face — the reveals come out of the border.
  // Framing bills one whole-frame figure, so per-part rates and discounts have
  // nothing to act on. Hidden rather than shown inert: a rate field that moves
  // no total teaches operators to distrust the screen.
  const isChopJoin = draft.billingMode === "chop_join";

  // A component discount is calculated against this section, not the entire
  // configured frame. Keep the readout on the same scope so, for example, a
  // 20% mat discount visibly changes the mat amount from 95 to 76 instead of
  // presenting only the much smaller movement in the whole frame total.
  const displayedAmount = useMemo(() => {
    if (!isChopJoin) return pricing.total;

    const amount = pricing.components.reduce((sum, component) => {
      const belongsToSection =
        section === "matting"
          ? component.kind === "mat"
          : section === "glazing"
            ? component.kind === "glazing"
            : ["backing", "flexipoints", "multipoints", "l_support"].includes(component.kind);

      return belongsToSection ? sum + component.amount : sum;
    }, 0);

    return Math.round(amount * 100) / 100;
  }, [isChopJoin, pricing.components, pricing.total, section]);

  const displayedAmountLabel = !isChopJoin
    ? t("lineTotal")
    : section === "matting"
      ? tc("mattingAmount")
      : section === "glazing"
        ? tc("glazingAmount")
        : tc("backingAndFittingAmount");

  const canAddLayer =
    draft.mat.layers.length < MAX_MAT_LAYERS &&
    matStackFitsBorder(draft.mat.border, draft.mat.layers.length + 1);

  const addLayer = () => {
    setDraft((current) => {
      if (current.mat.layers.length >= MAX_MAT_LAYERS) return current;
      if (!matStackFitsBorder(current.mat.border, current.mat.layers.length + 1)) {
        return current;
      }
      return {
        ...current,
        mat: {
          ...current.mat,
          // Removing the final layer turns matting off. Adding one again must
          // restore inclusion or geometry and pricing will ignore the layer.
          included: true,
          layers: [
            ...current.mat.layers,
            { layerIndex: current.mat.layers.length, matBoardItemId: "" },
          ],
        },
      };
    });
  };

  const removeLayer = (index: number) => {
    setDraft((current) => {
      const componentDiscounts = Object.fromEntries(
        Object.entries(current.componentDiscounts ?? {}).filter(([key]) => !key.startsWith("mat-"))
      );
      const layers = current.mat.layers
        .filter((_, position) => position !== index)
        .map((layer, position) => {
          const discount = current.componentDiscounts?.[`mat-${layer.layerIndex}`];
          if (discount) componentDiscounts[`mat-${position}`] = discount;
          return { ...layer, layerIndex: position };
        });
      return {
        ...current,
        componentDiscounts:
          Object.keys(componentDiscounts).length > 0 ? componentDiscounts : undefined,
        mat: {
          ...current.mat,
          // Removing the last layer is how matting is turned back off — there is
          // no "include" checkbox to untick.
          included: layers.length > 0,
          layers,
        },
      };
    });
    setDraftSelections((current) => {
      const matBoards = Object.fromEntries(
        Object.entries(current.matBoards)
          .filter(([position]) => Number(position) !== index)
          .map(([position, board]) => [
            Number(position) > index ? Number(position) - 1 : position,
            board,
          ])
      );
      return { ...current, matBoards };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-3rem)] w-[calc(100vw-4rem)] max-w-[980px] overflow-hidden p-0"
        /* A frame configuration is long-form work; a stray click on the
           backdrop must not discard it. Closing is deliberate only: the X, or
           Cancel. Escape is left alone as the standard accessible exit. */
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{tc(`sectionTitle.${section}`)}</DialogTitle>
          <DialogDescription>
            {tc("subtitle", {
              length: geometry.artwork.lengthIn,
              width: geometry.artwork.widthIn,
              count: Math.max(1, draft.quantity),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[72vh] grid-cols-1 overflow-hidden lg:grid-cols-[minmax(420px,1fr)_300px]">
          <div className="space-y-3 overflow-y-auto px-6 py-6">
            {section === "matting" ? (
              <>
                  {/* Who supplies the board only ever changed the requisition
                      wording, and framing bills one figure regardless — so the
                      toggle has nothing to affect here. */}
                  {isChopJoin ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <SegmentedControl
                      aria-label={t("boardSource")}
                      value={draft.mat.source}
                      options={[
                        { value: "store", label: t("storeBoard") },
                        { value: "customer", label: t("customerBoard") },
                      ]}
                      onChange={(source) =>
                        setDraft((c) => ({ ...c, mat: { ...c.mat, source } }))
                      }
                    />
                    {/* The rate sits with the toggle: who supplied the board
                        and what the shop charges for it are one decision, and
                        an operator switching to a customer's board is the one
                        most likely to want the rate next. */}
                    <div className="flex w-32 flex-col gap-1.5">
                      <Label htmlFor="mat-rate" className="text-xs">
                        {t("ratePerInch")} *
                      </Label>
                      <Input
                        id="mat-rate"
                        className="h-8 text-right font-mono text-sm tabular-nums"
                        inputMode="decimal"
                        required
                        aria-invalid={draft.mat.unitRate <= 0}
                        // Empty rather than "0": a zero looks like a decision,
                        // an empty field looks like the question it is.
                        value={draft.mat.unitRate || ""}
                        placeholder="0"
                        onChange={(event) =>
                          setDraft((c) => ({
                            ...c,
                            mat: { ...c.mat, unitRate: Number(event.target.value) || 0 },
                          }))
                        }
                      />
                    </div>
                  </div>
                  ) : null}

                  <div className="space-y-2">
                    {draft.mat.layers.map((layer, index) => (
                      <MatLayerRow
                        key={layer.layerIndex}
                        layer={layer}
                        position={index}
                        priced={isChopJoin}
                        boardOption={draftSelections.matBoards[index] ?? null}
                        discounts={draft.componentDiscounts ?? {}}
                        onDiscountsChange={(componentDiscounts) =>
                          setDraft((c) => ({ ...c, componentDiscounts }))
                        }
                        onBoardSelect={(item) => {
                          setDraftSelections((current) => ({
                            ...current,
                            matBoards: { ...current.matBoards, [index]: item },
                          }));
                          updateLayer(index, { matBoardItemId: item.id });
                        }}
                        // Every layer is removable, the top one included:
                        // removing the last is how matting is switched off.
                        onRemove={() => removeLayer(index)}
                      />
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed"
                    onClick={addLayer}
                    disabled={!canAddLayer}
                    title={canAddLayer ? undefined : t("borderTooNarrow")}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {t("addMatLayer")}
                  </Button>
                  {!canAddLayer && draft.mat.layers.length < MAX_MAT_LAYERS ? (
                    <p className="text-xs text-muted-foreground">{t("borderTooNarrow")}</p>
                  ) : null}

                  {/* The border belongs to the stack, so it sits below the list
                      rather than on the top layer's row: adding a mat divides
                      this figure, it never adds to it. */}
                  <MatBorderRow
                    border={draft.mat.border}
                    layerCount={draft.mat.layers.length}
                    onChange={(border) =>
                      setDraft((c) => ({ ...c, mat: { ...c.mat, border } }))
                    }
                  />
              </>
            ) : null}

            {section === "glazing" ? (
              <>
                <div className="space-y-4">
                  {/* One type only, as the legacy job-order screen offers them. */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {GLAZING_TYPES.map((entry) => {
                      const selected =
                        draft.glazing.included && draft.glazing.glazingType === entry.type;
                      return (
                        <button
                          key={entry.type}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              glazing: {
                                ...current.glazing,
                                // Tapping the selected type clears it — a frame
                                // can legitimately have no glazing, and with no
                                // "include" checkbox this is the way back off.
                                included: !selected,
                                glazingType: entry.type,
                                glazingItemId: selected
                                  ? null
                                  : materials.glazingItemId(entry.type),
                                label: selected ? "" : tc(`glazingType.${entry.type}`),
                                // Only double glass takes more than one pane, so
                                // switching away resets the count rather than
                                // leaving a stale 2 on a single-pane type.
                                sheets: glazingSheetsEditable(entry.type)
                                  ? Math.max(2, current.glazing.sheets)
                                  : 1,
                              },
                            }))
                          }
                          className={cn(
                            "flex flex-col gap-1.5 rounded-[10px] border bg-background p-2.5 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/5 ring-[3px] ring-primary/10"
                              : "hover:border-primary/40"
                          )}
                        >
                          <span
                            className="h-6 w-full rounded-md border border-black/10"
                            style={{ background: entry.swatch }}
                            aria-hidden
                          />
                          <span className="text-[12.5px] font-bold leading-tight">
                            {tc(`glazingType.${entry.type}`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {draft.glazing.included ? (
                  <div className="flex flex-wrap items-end gap-3">
                    {isChopJoin ? (
                      <>
                        <div className="flex w-28 flex-col gap-1.5">
                          <Label htmlFor="glazing-rate" className="text-xs">{t("ratePerSqIn")}</Label>
                          <Input
                            id="glazing-rate"
                            className="h-8 text-right font-mono text-sm tabular-nums"
                            inputMode="decimal"
                            value={draft.glazing.unitRate}
                            onChange={(event) =>
                              setDraft((c) => ({
                                ...c,
                                glazing: {
                                  ...c.glazing,
                                  unitRate: Number(event.target.value) || 0,
                                },
                              }))
                            }
                          />
                        </div>
                        <ComponentDiscountInput
                          componentKey="glazing"
                          discounts={draft.componentDiscounts}
                          onChange={(componentDiscounts) =>
                            setDraft((c) => ({ ...c, componentDiscounts }))
                          }
                        />
                      </>
                    ) : null}
                    <div className="flex w-24 flex-col gap-1.5">
                      <Label htmlFor="glazing-sheets" className="text-xs">{t("sheets")}</Label>
                      <Input
                        id="glazing-sheets"
                        className={cn(
                          "h-8 font-mono text-sm tabular-nums",
                          // A field that ignores typing should not look typeable.
                          !glazingSheetsEditable(draft.glazing.glazingType) &&
                            "bg-muted text-muted-foreground"
                        )}
                        inputMode="numeric"
                        // Every type but double glass is a single pane, so the
                        // count is not the user's to set.
                        readOnly={!glazingSheetsEditable(draft.glazing.glazingType)}
                        aria-readonly={!glazingSheetsEditable(draft.glazing.glazingType)}
                        title={
                          glazingSheetsEditable(draft.glazing.glazingType)
                            ? undefined
                            : tc("sheetsFixed")
                        }
                        value={draft.glazing.sheets}
                        onChange={(event) =>
                          setDraft((c) => ({
                            ...c,
                            glazing: { ...c.glazing, sheets: Number(event.target.value) || 1 },
                          }))
                        }
                      />
                    </div>
                    <Label className="flex h-8 items-center gap-2 text-sm font-normal">
                      <Checkbox
                        checked={draft.glazing.cutToMatOuter}
                        onCheckedChange={(checked) =>
                          setDraft((c) => ({
                            ...c,
                            glazing: { ...c.glazing, cutToMatOuter: checked === true },
                          }))
                        }
                      />
                      {t("cutToMatOuter")}
                    </Label>
                  </div>
                  ) : null}

                </div>
              </>
            ) : null}

            {section === "backing" ? (
              <>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {tc("board")}
              </p>

              {/* One board type, chosen the same way glass is — the catalogue
                  holds pre-cut sizes, not the board types a frame is backed with. */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BACKING_TYPES.map((entry) => {
                  const selected = draft.backing.backingType === entry.type;
                  return (
                    <button
                      key={entry.type}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          backing: {
                            ...current.backing,
                            // Tapping the selected board clears it — a frame can
                            // legitimately have no backing at all.
                            backingType: selected ? null : entry.type,
                            backingItemId: selected ? null : materials.backingItemId(entry.type),
                            label: selected ? "" : tc(`backingType.${entry.type}`),
                          },
                        }))
                      }
                      className={cn(
                        "flex flex-col gap-1.5 rounded-[10px] border bg-background p-2.5 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-[3px] ring-primary/10"
                          : "hover:border-primary/40"
                      )}
                    >
                      <span
                        className="h-6 w-full rounded-md border border-black/10"
                        style={{ background: entry.swatch }}
                        aria-hidden
                      />
                      <span className="text-[12.5px] font-bold leading-tight">
                        {tc(`backingType.${entry.type}`)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {draft.backing.backingType ? (
                <div className="flex flex-wrap items-end gap-3">
                  {isChopJoin ? (
                    <>
                      <div className="flex w-28 flex-col gap-1.5">
                        <Label htmlFor="backing-rate" className="text-xs">{t("ratePerSqIn")}</Label>
                        <Input
                          id="backing-rate"
                          className="h-8 text-right font-mono text-sm tabular-nums"
                          inputMode="decimal"
                          value={draft.backing.unitRate}
                          onChange={(event) =>
                            setDraft((c) => ({
                              ...c,
                              backing: {
                                ...c.backing,
                                unitRate: Number(event.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </div>
                      <ComponentDiscountInput
                        componentKey="backing"
                        discounts={draft.componentDiscounts}
                        onChange={(componentDiscounts) =>
                          setDraft((c) => ({ ...c, componentDiscounts }))
                        }
                      />
                    </>
                  ) : null}

                  {draft.backing.backingType === "plywood" ? (
                    <div className="flex w-28 flex-col gap-1.5">
                      <Label htmlFor="backing-thickness" className="text-xs">{tc("thickness")}</Label>
                      <FractionInput
                        id="backing-thickness"
                        className="h-8 font-mono text-sm tabular-nums"
                        value={draft.backing.thicknessIn ?? 0}
                        onCommit={(thicknessIn) =>
                          setDraft((c) => ({
                            ...c,
                            backing: { ...c.backing, thicknessIn },
                          }))
                        }
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Flexipoints, multipoints and L-supports are inside the frame
                  rate in framing mode — the customer buys a finished frame, so
                  there is nothing here to choose or price. Chop & join bills
                  each of them as its own line. */}
              {isChopJoin ? (
                <>
              <p className="pt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {tc("fittingHardware")}
              </p>

              <div className="space-y-2">
                {(
                  [
                    { key: "flexipoints", label: t("flexipoints") },
                    { key: "multipoints", label: t("multipoints") },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <Checkbox
                      checked={draft.hardware[key].included}
                      onCheckedChange={(checked) =>
                        setDraft((c) => ({
                          ...c,
                          hardware: {
                            ...c.hardware,
                            [key]: { ...c.hardware[key], included: checked === true },
                          },
                        }))
                      }
                      aria-label={label}
                    />
                    <span className="flex-1 text-sm font-medium">{label}</span>
                    {/* The fraction is a size, not a count, and both of its
                        integers set the price — see `pointAmount` in
                        lib/framing/pricing. Hence its own input: the shared
                        FractionInput would collapse "1/2" to 0.5 and lose the
                        distinction from "2/4", which bills double. */}
                    <PointFractionInput
                      className="h-8 w-20 font-mono text-sm tabular-nums"
                      aria-label={t("fractionFor", { item: label })}
                      value={draft.hardware[key].fraction}
                      onCommit={(fraction) =>
                        setDraft((c) => ({
                          ...c,
                          hardware: {
                            ...c.hardware,
                            [key]: { ...c.hardware[key], fraction },
                          },
                        }))
                      }
                    />
                  </div>
                ))}

                <div className="flex items-center gap-3 rounded-lg border p-2.5">
                  <Checkbox
                    checked={draft.hardware.lSupport.included}
                    onCheckedChange={(checked) =>
                      setDraft((c) => ({
                        ...c,
                        hardware: {
                          ...c.hardware,
                          lSupport: { ...c.hardware.lSupport, included: checked === true },
                        },
                      }))
                    }
                    aria-label={t("lSupport")}
                  />
                  <span className="flex-1 text-sm font-medium">{t("lSupport")}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={draft.hardware.lSupport.size === "small" ? "secondary" : "ghost"}
                    onClick={() =>
                      setDraft((c) => ({
                        ...c,
                        hardware: {
                          ...c.hardware,
                          lSupport: {
                            ...c.hardware.lSupport,
                            size: "small",
                            itemId: hardware.lSupport.small?.itemId ?? null,
                            unitRate: hardware.lSupport.small?.unitRate ?? 32,
                          },
                        },
                      }))
                    }
                  >
                    {t("small")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={draft.hardware.lSupport.size === "big" ? "secondary" : "ghost"}
                    onClick={() =>
                      setDraft((c) => ({
                        ...c,
                        hardware: {
                          ...c.hardware,
                          lSupport: {
                            ...c.hardware.lSupport,
                            size: "big",
                            itemId: hardware.lSupport.big?.itemId ?? null,
                            unitRate: hardware.lSupport.big?.unitRate ?? 72,
                          },
                        },
                      }))
                    }
                  >
                    {t("big")}
                  </Button>
                </div>
              </div>
                </>
              ) : null}
              </>
            ) : null}
          </div>

          <aside className="space-y-4 overflow-y-auto border-t bg-muted/40 px-5 py-6 lg:border-l lg:border-t-0">
            <ZoomablePreview config={draft} matColors={matColors} size={200} />

            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <Readout label={t("matOuter")} value={
                geometry.matOuter
                  ? `${geometry.matOuter.lengthIn}″ × ${geometry.matOuter.widthIn}″`
                  : "—"
              } />
              <Readout label={tc("topOpening")} value={
                geometry.openings.length > 0
                  ? `${geometry.openings[0].lengthIn}″ × ${geometry.openings[0].widthIn}″`
                  : "—"
              } />
              <Readout label={t("frameOutside")} value={
                `${geometry.outside.lengthIn}″ × ${geometry.outside.widthIn}″`
              } />
              <Readout label={displayedAmountLabel} value={formatCurrency(displayedAmount)} />
            </dl>

            {fitWarning ? (
              <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>{fitWarning}</span>
              </p>
            ) : (
              <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>{tc("allBoardsClear")}</span>
              </p>
            )}
          </aside>
        </div>

        <DialogFooter className="border-t px-6 py-3">
          <span className="mr-auto truncate font-mono text-xs text-muted-foreground">
            {draftErrors[0] ?? specSummary(draft)}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          {/* Applying an unselected mat board committed a priced mat the
              workshop cannot pull. The outer dialog blocked saving it, but this
              button reached past that guard. */}
          <Button disabled={draftErrors.length > 0} onClick={() => onApply(draft, draftSelections)}>
            {tc("applyToFrame")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-2.5">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
