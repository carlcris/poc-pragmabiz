"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ItemSelect, type ItemSelectOption } from "@/components/common/ItemSelect";
import { useResolvedCustomerPricing } from "@/hooks/useCustomerPricing";
import { useCurrency } from "@/hooks/useCurrency";
import { formatFrameOutsideSize, frameSpecSummary } from "@/lib/framing/description";
import { formatLineDiscount } from "@/lib/framing/invoicePresenter";
import { discountRateOf } from "@/lib/framing/invoicePresenter";
import {
  salesOrderLinePricing,
  type QuotationLinePricing,
} from "@/lib/sales-orders/sales-order-line-pricing";
import {
  getDefaultPriceTierCode,
  getItemPriceTierOptions,
  resolvePriceTierSelection,
} from "@/lib/pricing/itemPriceTiers";
import { salesOrderLineEditValues } from "@/lib/sales-orders/sales-order-line-edit-values";
import type {
  FrameQuotationComponent,
  FrameQuotationConfiguration,
  FrameQuotationMatLayer,
  FrameQuotationSize,
} from "@/types/quotation";

export type SalesOrderLineItemFormValues = {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  quotationId?: string | null;
  quotationNumber?: string;
  quotationItemId?: string | null;
  quotationRemainingQuantity?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  uomId: string;
  uomCode?: string;
  uomName?: string;
  pricingTier?: string;
  pricingTierName?: string;
  discount: number;
  discountAmount?: number;
  quotationPricing?: QuotationLinePricing;
  taxRate: number;
  lineTotal?: number;
  available?: number;
  reorderPoint?: number;
  skipInventory?: boolean;
  frameConfiguration?: FrameQuotationConfiguration | null;
  frameComponents?: FrameQuotationComponent[];
  matLayers?: FrameQuotationMatLayer[];
  frameSizes?: FrameQuotationSize[];
};

type SalesOrderLineItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: SalesOrderLineItemFormValues) => void;
  item?: SalesOrderLineItemFormValues | null;
  mode?: "add" | "edit";
  customerId?: string;
};

const emptyLineItem: SalesOrderLineItemFormValues = {
  itemId: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  uomId: "",
  discount: 0,
  taxRate: 0,
};

/**
 * One line of the closing figures panel.
 *
 * Locked values render as text rather than as disabled inputs: an input box on
 * this dialog means "you may type here", and dressing read-only figures as
 * boxes is what made the quotation cases unreadable.
 */
function Figure({
  label,
  value,
  total = false,
}: {
  label: string;
  value: string;
  total?: boolean;
}) {
  return (
    <div
      className={
        total
          ? "flex items-baseline justify-between gap-6 border-t pt-3"
          : "flex items-baseline justify-between gap-6"
      }
    >
      <span className={total ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>
        {label}
      </span>
      <span className={total ? "text-base font-semibold tabular-nums" : "text-sm tabular-nums"}>
        {value}
      </span>
    </div>
  );
}

const toSelectedOption = (item: SalesOrderLineItemFormValues): ItemSelectOption | null =>
  item.itemId
    ? {
        id: item.itemId,
        code: item.itemCode || "",
        name: item.itemName || item.description,
        description: item.description,
        uom: item.uomCode || item.uomName || "",
        uomId: item.uomId,
        listPrice: item.unitPrice,
        defaultPriceTier: item.pricingTier,
      }
    : null;

export function SalesOrderLineItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
  customerId,
}: SalesOrderLineItemDialogProps) {
  const t = useTranslations("salesOrderLineItemDialog");
  const tCommon = useTranslations("common");
  const { formatCurrency } = useCurrency();
  const [values, setValues] = useState<SalesOrderLineItemFormValues>(emptyLineItem);
  const [selectedOption, setSelectedOption] = useState<ItemSelectOption | null>(null);
  const [pendingPriceItemId, setPendingPriceItemId] = useState<string | null>(null);
  const isQuotationLine = !!values.quotationItemId;
  const isConfiguredQuotationLine = isQuotationLine && !!values.frameSizes?.length;

  useEffect(() => {
    if (!open) return;
    const nextValues = item ? salesOrderLineEditValues(item) : { ...emptyLineItem };
    setValues(nextValues);
    setSelectedOption(toSelectedOption(nextValues));
    setPendingPriceItemId(null);
  }, [item, open]);

  const { data: resolvedCustomerPricing } = useResolvedCustomerPricing({
    customerId,
    itemIds: values.itemId ? [values.itemId] : [],
    enabled: open && !isQuotationLine,
  });
  const resolvedPriceTiers = resolvedCustomerPricing?.data.find(
    (entry) => entry.itemId === values.itemId
  )?.priceTiers;
  const pricingOption = useMemo(
    () =>
      selectedOption && resolvedPriceTiers
        ? { ...selectedOption, priceTiers: resolvedPriceTiers }
        : selectedOption,
    [resolvedPriceTiers, selectedOption]
  );
  const priceTierOptions = pricingOption ? getItemPriceTierOptions(pricingOption) : [];
  const selectedPricingTier =
    values.pricingTier || (pricingOption ? getDefaultPriceTierCode(pricingOption) : "");

  useEffect(() => {
    if (!pricingOption || !resolvedPriceTiers || pendingPriceItemId !== values.itemId) return;
    const selection = resolvePriceTierSelection(pricingOption, values.pricingTier);
    setValues((current) => ({
      ...current,
      pricingTier: selection.priceTier,
      pricingTierName: selection.priceTierName,
      unitPrice: selection.price,
    }));
    setPendingPriceItemId(null);
  }, [pendingPriceItemId, pricingOption, resolvedPriceTiers, values.itemId, values.pricingTier]);

  const updateValue = <Key extends keyof SalesOrderLineItemFormValues>(
    key: Key,
    value: SalesOrderLineItemFormValues[Key]
  ) => setValues((current) => ({ ...current, [key]: value }));

  const handleItemSelect = (selected: ItemSelectOption) => {
    const price = resolvePriceTierSelection(selected);
    setSelectedOption(selected);
    setValues((current) => ({
      ...current,
      itemId: selected.id,
      itemCode: selected.code,
      itemName: selected.name,
      description: selected.description || "",
      uomId: selected.uomId,
      uomCode: selected.uom,
      uomName: selected.uom,
      pricingTier: price.priceTier,
      pricingTierName: price.priceTierName,
      unitPrice: price.price,
      available: selected.available,
      reorderPoint: selected.reorderPoint,
    }));
    setPendingPriceItemId(customerId ? selected.id : null);
  };

  const handlePricingTierChange = (tier: string) => {
    if (!pricingOption) return;
    const selection = resolvePriceTierSelection(pricingOption, tier);
    setValues((current) => ({
      ...current,
      pricingTier: selection.priceTier,
      pricingTierName: selection.priceTierName,
      unitPrice: selection.price,
    }));
  };

  const updateSizeQuantity = (sizeIndex: number, quantity: number) => {
    const frameSizes = (values.frameSizes || []).map((size, index) =>
      index === sizeIndex
        ? {
            ...size,
            frameConfiguration: { ...size.frameConfiguration, frameQuantity: quantity },
          }
        : size
    );
    updateValue("frameSizes", frameSizes);
    updateValue(
      "quantity",
      frameSizes.reduce((total, size) => total + (size.frameConfiguration.frameQuantity || 0), 0)
    );
  };

  const validateAndSave = () => {
    if (isQuotationLine && !values.quotationPricing) {
      toast.error(t("quotationPricingUnavailable"));
      return;
    }
    if (!values.itemId) {
      toast.error(t("itemRequired"));
      return;
    }
    if (!values.uomId) {
      toast.error(t("uomRequired"));
      return;
    }
    if (values.quantity <= 0) {
      toast.error(t("quantityRequired"));
      return;
    }
    if (values.unitPrice < 0) {
      toast.error(t("unitPriceRequired"));
      return;
    }
    if (isConfiguredQuotationLine) {
      const exceedsRemaining = values.frameSizes?.some(
        (size) =>
          size.remainingQuantity !== undefined &&
          (size.frameConfiguration.frameQuantity || 0) > size.remainingQuantity
      );
      if (exceedsRemaining) {
        toast.error(t("sizeQuantityExceedsRemaining"));
        return;
      }
    } else if (
      isQuotationLine &&
      values.quotationRemainingQuantity !== undefined &&
      values.quantity > values.quotationRemainingQuantity
    ) {
      toast.error(t("quantityExceedsRemaining"));
      return;
    }
    onSave(values);
    onOpenChange(false);
  };

  const pricingTierLabel = values.pricingTierName || values.pricingTier || "";
  // Shown per size row rather than once in the header: the stored description
  // pairs every size's dimensions with only the first size's spec.
  const lineSpec = frameSpecSummary(values.description);
  const {
    subtotal,
    totalDiscount: discountAmount,
    totalTax: taxAmount,
    totalAmount: lineTotal,
    sizeAmounts,
  } = salesOrderLinePricing(values);
  const showInventoryWarning =
    !isQuotationLine && values.available !== undefined && values.quantity > values.available;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dvh max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isQuotationLine
              ? t("quotationTitle")
              : t(mode === "edit" ? "editTitle" : "createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isQuotationLine
              ? t("quotationDescription")
              : t(mode === "edit" ? "editDescription" : "createDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {isQuotationLine ? (
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{values.itemName}</div>
                  <div className="text-sm text-muted-foreground">
                    {values.itemCode} · {values.quotationNumber}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {t("fromQuotation")}
                </span>
              </div>
              {/* A configured line's description carries one size's spec but every
                  size's dimensions, so it misattributes size 1's moulding and mat
                  to the rest. Those belong per row; only an unconfigured line
                  (no sizes table below) still needs a description here. */}
              {!isConfiguredQuotationLine ? (
                <p className="mt-2 text-sm">{values.description}</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{tCommon("item")} *</Label>
              <ItemSelect
                value={values.itemId}
                onValueChange={(itemId) => updateValue("itemId", itemId)}
                onItemSelect={handleItemSelect}
                selectedOption={selectedOption}
                includeStock
                showStock
                renderTrailing={(option) => formatCurrency(resolvePriceTierSelection(option).price)}
                placeholder={t("searchItem")}
                searchPlaceholder={t("itemSearchPlaceholder")}
                emptyMessage={t("noItemFound")}
              />
            </div>
          )}

          {!isQuotationLine ? (
            <div className="space-y-2">
              <Label htmlFor="sales-order-line-description">{t("description")}</Label>
              <Textarea
                id="sales-order-line-description"
                value={values.description}
                onChange={(event) => updateValue("description", event.target.value)}
                rows={2}
              />
            </div>
          ) : null}

          {isConfiguredQuotationLine ? (
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[1.5fr_1fr_110px_1fr] gap-3 border-b bg-muted/40 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("sizeColumn")}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("quotedRemainingColumn")}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("orderQuantityColumn")}
                </span>
                <span className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("amountColumn")}
                </span>
              </div>
              {values.frameSizes?.map((size, index) => {
                const configuration = size.frameConfiguration;
                const sizeKey = configuration.quotationConfigurationId || configuration.id || index;
                const sizeQuantity = configuration.frameQuantity || 0;
                return (
                  <div
                    key={sizeKey}
                    className="grid grid-cols-[1.5fr_1fr_110px_1fr] items-center gap-3 border-b px-4 py-3 last:border-b-0"
                  >
                    <div>
                      <div className="font-semibold tabular-nums">
                        {formatFrameOutsideSize(configuration.height, configuration.width)}
                      </div>
                      {lineSpec ? (
                        <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
                          {lineSpec}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-sm tabular-nums text-muted-foreground">
                      {t("quotedOverRemaining", {
                        quoted: size.quotedQuantity ?? sizeQuantity,
                        remaining: size.remainingQuantity ?? sizeQuantity,
                      })}
                    </div>
                    <div>
                      <Label htmlFor={`frame-size-quantity-${index}`} className="sr-only">
                        {t("orderQuantity")}
                      </Label>
                      <Input
                        id={`frame-size-quantity-${index}`}
                        type="number"
                        className="h-9 text-right tabular-nums"
                        min={0}
                        max={size.remainingQuantity}
                        step={1}
                        value={sizeQuantity}
                        onChange={(event) =>
                          updateSizeQuantity(index, Number(event.target.value) || 0)
                        }
                      />
                    </div>
                    <div
                      className={
                        sizeQuantity > 0
                          ? "text-right tabular-nums"
                          : "text-right tabular-nums text-muted-foreground"
                      }
                    >
                      {formatCurrency(sizeAmounts[index] ?? 0)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : isQuotationLine ? (
            <div className="space-y-2">
              <Label htmlFor="sales-order-line-quantity">{t("orderQuantity")} *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="sales-order-line-quantity"
                  type="number"
                  className="w-32 text-right tabular-nums"
                  min={0.01}
                  max={values.quotationRemainingQuantity}
                  step={0.01}
                  value={values.quantity}
                  onChange={(event) => updateValue("quantity", Number(event.target.value) || 0)}
                />
                <span className="text-sm text-muted-foreground">
                  {values.uomCode || values.uomName || "—"}
                </span>
              </div>
              {values.quotationRemainingQuantity !== undefined ? (
                <p className="text-xs text-muted-foreground">
                  {t("remainingOnQuotation", { remaining: values.quotationRemainingQuantity })}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sales-order-line-quantity">{t("quantity")} *</Label>
                <Input
                  id="sales-order-line-quantity"
                  type="number"
                  className="text-right tabular-nums"
                  min={0.01}
                  step={0.01}
                  value={values.quantity}
                  onChange={(event) => updateValue("quantity", Number(event.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("unit")}</Label>
                <Input value={values.uomCode || values.uomName || "—"} disabled />
              </div>
            </div>
          )}

          {showInventoryWarning ? (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertDescription>
                {t("inventoryWarning", {
                  requested: values.quantity.toFixed(2),
                  available: (values.available || 0).toFixed(2),
                  uom: values.uomCode || values.uomName || "",
                })}
              </AlertDescription>
            </Alert>
          ) : null}

          {!isQuotationLine ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("pricingTier")}</Label>
                  <Select value={selectedPricingTier} onValueChange={handlePricingTierChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectPricingTier")} />
                    </SelectTrigger>
                    <SelectContent>
                      {priceTierOptions.map((tier) => (
                        <SelectItem key={tier.priceTier} value={tier.priceTier}>
                          {tier.priceTierName} ({formatCurrency(tier.price)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sales-order-line-price">{t("unitPrice")}</Label>
                  <Input
                    id="sales-order-line-price"
                    type="number"
                    className="text-right tabular-nums"
                    min={0}
                    step={0.01}
                    value={values.unitPrice}
                    onChange={(event) => updateValue("unitPrice", Number(event.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sales-order-line-discount">{t("discountRate")}</Label>
                  <Input
                    id="sales-order-line-discount"
                    type="number"
                    className="text-right tabular-nums"
                    min={0}
                    max={100}
                    step={0.01}
                    value={values.discount}
                    onChange={(event) => updateValue("discount", Number(event.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sales-order-line-tax">{t("taxRate")}</Label>
                  <Input
                    id="sales-order-line-tax"
                    type="number"
                    className="text-right tabular-nums"
                    min={0}
                    max={100}
                    step={0.01}
                    value={values.taxRate}
                    onChange={(event) => updateValue("taxRate", Number(event.target.value) || 0)}
                  />
                </div>
              </div>
            </>
          ) : null}

          {/* Every shape closes on the same figures panel, so the three cases
              read as one dialog rather than three. */}
          <div className="flex flex-col gap-2">
            {isConfiguredQuotationLine ? (
              <Figure label={t("framesOrdered")} value={String(values.quantity)} />
            ) : (
              <Figure
                label={`${t("unitPrice")}${pricingTierLabel ? ` · ${pricingTierLabel}` : ""}`}
                value={formatCurrency(values.unitPrice)}
              />
            )}
            <Figure label={t("subtotal")} value={formatCurrency(subtotal)} />
            {discountAmount > 0 ? (
              <Figure
                label={t("discountFigure")}
                value={formatLineDiscount(
                  discountAmount,
                  discountRateOf(discountAmount, subtotal - discountAmount),
                  formatCurrency
                )}
              />
            ) : null}
            {taxAmount > 0 ? (
              <Figure
                label={`${t("taxFigure")} (${values.taxRate}%)`}
                value={formatCurrency(taxAmount)}
              />
            ) : null}
            <Figure label={t("lineTotal")} value={formatCurrency(lineTotal)} total />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={validateAndSave}>
            {t(mode === "edit" ? "updateItem" : "addItem")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
