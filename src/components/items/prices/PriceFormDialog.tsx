"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ItemPrice = {
  id: string;
  itemId: string;
  priceTier: string;
  priceTierName: string;
  price: number;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
};

type PriceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  price?: ItemPrice | null;
};

type FormData = {
  priceTier: string;
  priceTierName: string;
  price: string;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
};

type PricePayload = Omit<FormData, "price"> & { price: number };

export const PriceFormDialog = ({ open, onOpenChange, itemId, price }: PriceFormDialogProps) => {
  const t = useTranslations("priceFormDialog");
  const queryClient = useQueryClient();
  const isEditing = !!price;

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      priceTier: "",
      priceTierName: "",
      price: "",
      currencyCode: "PHP",
      effectiveFrom: new Date().toISOString().split("T")[0],
      effectiveTo: "",
      isActive: true,
    },
  });

  const isActive = watch("isActive");

  // Initialize form when price changes
  useEffect(() => {
    if (price) {
      setValue("priceTier", price.priceTier);
      setValue("priceTierName", price.priceTierName);
      setValue("price", price.price.toString());
      setValue("currencyCode", price.currencyCode);
      setValue("effectiveFrom", price.effectiveFrom);
      setValue("effectiveTo", price.effectiveTo || "");
      setValue("isActive", price.isActive);
    } else {
      reset();
    }
  }, [price, reset, setValue]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: PricePayload) => {
      const response = await apiClient.post<{ data: ItemPrice }>(
        `/api/items/${itemId}/prices`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-prices", itemId] });
      toast.success(t("createSuccess"));
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("createError");
      toast.error(errorMessage);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: PricePayload) => {
      if (!price) throw new Error(t("noPriceSelected"));
      const response = await apiClient.put<{ data: ItemPrice }>(
        `/api/items/${itemId}/prices/${price.id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-prices", itemId] });
      toast.success(t("updateSuccess"));
      onOpenChange(false);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("updateError");
      toast.error(errorMessage);
    },
  });

  const onSubmit = (data: FormData) => {
    const payload: PricePayload = {
      priceTier: data.priceTier,
      priceTierName: data.priceTierName,
      price: data.price === "" ? 0 : Number(data.price),
      currencyCode: data.currencyCode,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo || "",
      isActive: data.isActive,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Common price tiers for quick selection
  const commonTiers = [
    { code: "fc", name: "Factory Cost" },
    { code: "ws", name: "Wholesale" },
    { code: "srp", name: "Suggested Retail Price" },
    { code: "gov", name: "Government" },
    { code: "reseller", name: "Reseller" },
    { code: "vip", name: "VIP" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {isEditing ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Price Tier Code */}
          <div className="space-y-2">
            <Label htmlFor="priceTier">
              {t("priceTierCodeLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="priceTier"
              {...register("priceTier", { required: t("priceTierCodeRequired") })}
              placeholder={t("priceTierCodePlaceholder")}
              disabled={isPending}
            />
            {errors.priceTier && (
              <p className="text-sm text-destructive">{errors.priceTier.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {t("commonTiers")}: {commonTiers.map((tier) => tier.code).join(", ")}
            </p>
          </div>

          {/* Price Tier Name */}
          <div className="space-y-2">
            <Label htmlFor="priceTierName">
              {t("priceTierNameLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="priceTierName"
              {...register("priceTierName", { required: t("priceTierNameRequired") })}
              placeholder={t("priceTierNamePlaceholder")}
              disabled={isPending}
            />
            {errors.priceTierName && (
              <p className="text-sm text-destructive">{errors.priceTierName.message}</p>
            )}
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">
              {t("priceLabel")} <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="price"
              control={control}
              rules={{
                required: t("priceRequired"),
                validate: (value) =>
                  value === "" || Number(value) >= 0 || t("priceMin"),
              }}
              render={({ field }) => (
                <Input
                  id="price"
                  type="number"
                  step="0.0001"
                  placeholder={t("pricePlaceholder")}
                  disabled={isPending}
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(event.target.value)}
                  onBlur={field.onBlur}
                />
              )}
            />
            {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
          </div>

          {/* Currency Code */}
          <div className="space-y-2">
            <Label htmlFor="currencyCode">{t("currencyCodeLabel")}</Label>
            <Input
              id="currencyCode"
              {...register("currencyCode")}
              placeholder={t("currencyCodePlaceholder")}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">{t("currencyCodeDescription")}</p>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">
                {t("effectiveFromLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="effectiveFrom"
                type="date"
                {...register("effectiveFrom", { required: t("effectiveFromRequired") })}
                disabled={isPending}
              />
              {errors.effectiveFrom && (
                <p className="text-sm text-destructive">{errors.effectiveFrom.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectiveTo">{t("effectiveToLabel")}</Label>
              <Input
                id="effectiveTo"
                type="date"
                {...register("effectiveTo")}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">{t("effectiveToDescription")}</p>
            </div>
          </div>

          {/* Is Active */}
          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setValue("isActive", checked)}
              disabled={isPending}
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              {t("activeLabel")}
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? t("updateAction") : t("createAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
