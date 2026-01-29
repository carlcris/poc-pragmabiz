"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
  price: number;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
};

export const PriceFormDialog = ({ open, onOpenChange, itemId, price }: PriceFormDialogProps) => {
  const queryClient = useQueryClient();
  const isEditing = !!price;

  const {
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
      price: 0,
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
      setValue("price", price.price);
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
    mutationFn: async (data: FormData) => {
      const response = await apiClient.post<{ data: ItemPrice }>(
        `/api/items/${itemId}/prices`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-prices", itemId] });
      toast.success("Price created successfully");
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to create price";
      toast.error(errorMessage);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!price) throw new Error("No price selected");
      const response = await apiClient.put<{ data: ItemPrice }>(
        `/api/items/${itemId}/prices/${price.id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-prices", itemId] });
      toast.success("Price updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to update price";
      toast.error(errorMessage);
    },
  });

  const onSubmit = (data: FormData) => {
    const payload = {
      priceTier: data.priceTier,
      priceTierName: data.priceTierName,
      price: Number(data.price),
      currencyCode: data.currencyCode,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo || undefined,
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
          <DialogTitle>{isEditing ? "Edit Price" : "Create Price"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update price tier information" : "Add a new price tier for this item"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Price Tier Code */}
          <div className="space-y-2">
            <Label htmlFor="priceTier">
              Price Tier Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="priceTier"
              {...register("priceTier", { required: "Price tier code is required" })}
              placeholder="e.g., fc, ws, srp"
              disabled={isPending}
            />
            {errors.priceTier && (
              <p className="text-sm text-destructive">{errors.priceTier.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Common tiers: {commonTiers.map((t) => t.code).join(", ")}
            </p>
          </div>

          {/* Price Tier Name */}
          <div className="space-y-2">
            <Label htmlFor="priceTierName">
              Price Tier Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="priceTierName"
              {...register("priceTierName", { required: "Price tier name is required" })}
              placeholder="e.g., Factory Cost, Wholesale"
              disabled={isPending}
            />
            {errors.priceTierName && (
              <p className="text-sm text-destructive">{errors.priceTierName.message}</p>
            )}
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">
              Price <span className="text-destructive">*</span>
            </Label>
            <Input
              id="price"
              type="number"
              step="0.0001"
              {...register("price", {
                required: "Price is required",
                min: { value: 0, message: "Price must be 0 or greater" },
              })}
              placeholder="0.0000"
              disabled={isPending}
            />
            {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
          </div>

          {/* Currency Code */}
          <div className="space-y-2">
            <Label htmlFor="currencyCode">Currency Code</Label>
            <Input
              id="currencyCode"
              {...register("currencyCode")}
              placeholder="PHP"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">Default: PHP (Philippine Peso)</p>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">
                Effective From <span className="text-destructive">*</span>
              </Label>
              <Input
                id="effectiveFrom"
                type="date"
                {...register("effectiveFrom", { required: "Effective from date is required" })}
                disabled={isPending}
              />
              {errors.effectiveFrom && (
                <p className="text-sm text-destructive">{errors.effectiveFrom.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectiveTo">Effective To (Optional)</Label>
              <Input
                id="effectiveTo"
                type="date"
                {...register("effectiveTo")}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">Leave empty for no expiry</p>
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
              Active
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update" : "Create"} Price
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
