"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useItems } from "@/hooks/useItems";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useCreateCustomerSpecialPrice,
  useUpdateCustomerSpecialPrice,
} from "@/hooks/useCustomerPricing";
import { getItemPriceTierOptions } from "@/lib/pricing/itemPriceTiers";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { CustomerItemPrice } from "@/types/customer-pricing";

type CustomerSpecialPriceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  price?: CustomerItemPrice | null;
};

type FormState = {
  itemId: string;
  priceTier: string;
  price: string;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const getInitialState = (price?: CustomerItemPrice | null): FormState => ({
  itemId: price?.itemId || "",
  priceTier: price?.priceTier || "",
  price: price ? String(price.price) : "",
  currencyCode: price?.currencyCode || "PHP",
  effectiveFrom: price?.effectiveFrom || new Date().toISOString().slice(0, 10),
  effectiveTo: price?.effectiveTo || "",
  isActive: price?.isActive ?? true,
});

export const CustomerSpecialPriceFormDialog = ({
  open,
  onOpenChange,
  customerId,
  price,
}: CustomerSpecialPriceFormDialogProps) => {
  const t = useTranslations("customerSpecialPrices");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [formState, setFormState] = useState<FormState>(() => getInitialState(price));
  const [errors, setErrors] = useState<FormErrors>({});
  const [itemSearch, setItemSearch] = useState("");
  const debouncedItemSearch = useDebouncedValue(itemSearch.trim());
  const isEditing = Boolean(price);

  const { data: itemsData, isLoading: isItemsLoading } = useItems({
    search: debouncedItemSearch || undefined,
    limit: 5,
    enabled: open && !isEditing,
  });
  const items = itemsData?.data || [];
  const selectedItem = items.find((item) => item.id === formState.itemId) || null;
  const tierOptions = useMemo(
    () => (selectedItem ? getItemPriceTierOptions(selectedItem) : []),
    [selectedItem]
  );
  const selectedTier = tierOptions.find((tier) => tier.priceTier === formState.priceTier);

  const createMutation = useCreateCustomerSpecialPrice(customerId);
  const updateMutation = useUpdateCustomerSpecialPrice(customerId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!open) return;
    setFormState(getInitialState(price));
    setErrors({});
    setItemSearch("");
  }, [open, price]);

  const setField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setFormState((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!isEditing && !formState.itemId) nextErrors.itemId = t("itemRequired");
    if (!isEditing && !formState.priceTier) nextErrors.priceTier = t("tierRequired");
    if (formState.price.trim() === "") nextErrors.price = t("priceRequired");
    if (Number(formState.price) < 0) nextErrors.price = t("priceMinimum");
    if (!formState.effectiveFrom) nextErrors.effectiveFrom = t("effectiveFromRequired");
    if (
      formState.effectiveTo &&
      formState.effectiveFrom &&
      formState.effectiveTo < formState.effectiveFrom
    ) {
      nextErrors.effectiveTo = t("invalidDateRange");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      if (price) {
        await updateMutation.mutateAsync({
          priceId: price.id,
          data: {
            price: Number(formState.price),
            currencyCode: formState.currencyCode,
            effectiveFrom: formState.effectiveFrom,
            effectiveTo: formState.effectiveTo || null,
            isActive: formState.isActive,
          },
        });
        toast.success(t("updateSuccess"));
      } else {
        await createMutation.mutateAsync({
          itemId: formState.itemId,
          priceTier: formState.priceTier,
          price: Number(formState.price),
          currencyCode: formState.currencyCode,
          effectiveFrom: formState.effectiveFrom,
          effectiveTo: formState.effectiveTo || null,
          isActive: formState.isActive,
        });
        toast.success(t("createSuccess"));
      }
      onOpenChange(false);
    } catch {
      toast.error(t("saveError"));
    }
  };

  const formatPrice = (value: number, currencyCode: string) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t(isEditing ? "editTitle" : "createTitle")}</DialogTitle>
          <DialogDescription>
            {t(isEditing ? "editDescription" : "createDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {isEditing && price ? (
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">{t("item")}</p>
                <p className="font-medium">
                  {price.itemCode} - {price.itemName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("tier")}</p>
                <p className="font-medium uppercase">{price.priceTier}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="customer-special-price-item">
                  {t("item")} <span className="text-destructive">*</span>
                </Label>
                <AsyncSearchCombobox
                  value={formState.itemId}
                  onValueChange={(itemId) => {
                    setField("itemId", itemId);
                    setField("priceTier", "");
                  }}
                  searchValue={itemSearch}
                  onSearchValueChange={setItemSearch}
                  options={items.filter((item) => item.isActive)}
                  selectedOption={selectedItem}
                  getOptionValue={(item) => item.id}
                  getOptionLabel={(item) => `${item.code} - ${item.name}`}
                  getOptionSearchValue={(item) => `${item.code} ${item.name}`}
                  placeholder={t("selectItem")}
                  searchPlaceholder={t("searchItems")}
                  emptyMessage={t("noItems")}
                  loadingMessage={tCommon("loading")}
                  isLoading={isItemsLoading}
                  disabled={isPending}
                />
                {errors.itemId ? <p className="text-sm text-destructive">{errors.itemId}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-special-price-tier">
                  {t("tier")} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formState.priceTier}
                  onValueChange={(value) => setField("priceTier", value)}
                  disabled={!selectedItem || tierOptions.length === 0 || isPending}
                >
                  <SelectTrigger
                    id="customer-special-price-tier"
                    className={errors.priceTier ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder={t("selectTier")} />
                  </SelectTrigger>
                  <SelectContent>
                    {tierOptions.map((tier) => (
                      <SelectItem key={tier.priceTier} value={tier.priceTier}>
                        {tier.priceTier.toUpperCase()} - {tier.priceTierName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.priceTier ? (
                  <p className="text-sm text-destructive">{errors.priceTier}</p>
                ) : selectedTier ? (
                  <p className="text-xs text-muted-foreground">
                    {t("standardPrice", {
                      price: formatPrice(selectedTier.price, formState.currencyCode),
                    })}
                  </p>
                ) : null}
              </div>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer-special-price">
                {t("price")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer-special-price"
                type="number"
                min="0"
                step="0.01"
                value={formState.price}
                onChange={(event) => setField("price", event.target.value)}
                disabled={isPending}
                className={errors.price ? "border-destructive" : ""}
              />
              {errors.price ? <p className="text-sm text-destructive">{errors.price}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-special-price-currency">{t("currency")}</Label>
              <Input
                id="customer-special-price-currency"
                maxLength={3}
                value={formState.currencyCode}
                onChange={(event) => setField("currencyCode", event.target.value.toUpperCase())}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer-special-price-from">
                {t("effectiveFrom")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer-special-price-from"
                type="date"
                value={formState.effectiveFrom}
                onChange={(event) => setField("effectiveFrom", event.target.value)}
                disabled={isPending}
                className={errors.effectiveFrom ? "border-destructive" : ""}
              />
              {errors.effectiveFrom ? (
                <p className="text-sm text-destructive">{errors.effectiveFrom}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-special-price-to">{t("effectiveTo")}</Label>
              <Input
                id="customer-special-price-to"
                type="date"
                value={formState.effectiveTo}
                onChange={(event) => setField("effectiveTo", event.target.value)}
                disabled={isPending}
                className={errors.effectiveTo ? "border-destructive" : ""}
              />
              {errors.effectiveTo ? (
                <p className="text-sm text-destructive">{errors.effectiveTo}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="customer-special-price-active"
              checked={formState.isActive}
              onCheckedChange={(checked) => setField("isActive", checked === true)}
              disabled={isPending}
            />
            <Label htmlFor="customer-special-price-active">{t("activePrice")}</Label>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? t("saving") : tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
