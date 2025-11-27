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
import type { ItemPackaging, CreateItemPackagingInput, UpdateItemPackagingInput } from "@/types/item-variant";

type PackagingFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  variantId: string;
  packaging?: ItemPackaging | null;
};

type FormData = {
  packType: string;
  packName: string;
  qtyPerPack: number;
  barcode: string;
  isActive: boolean;
};

export const PackagingFormDialog = ({ open, onOpenChange, itemId, variantId, packaging }: PackagingFormDialogProps) => {
  const queryClient = useQueryClient();
  const isEditing = !!packaging;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      packType: "",
      packName: "",
      qtyPerPack: 1,
      barcode: "",
      isActive: true,
    },
  });

  const isActive = watch("isActive");

  // Initialize form when packaging changes
  useEffect(() => {
    if (packaging) {
      setValue("packType", packaging.packType);
      setValue("packName", packaging.packName);
      setValue("qtyPerPack", packaging.qtyPerPack);
      setValue("barcode", packaging.barcode || "");
      setValue("isActive", packaging.isActive);
    } else {
      reset();
    }
  }, [packaging, reset, setValue]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateItemPackagingInput) => {
      const response = await apiClient.post<{ data: ItemPackaging }>(
        `/api/items/${itemId}/variants/${variantId}/packaging`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-packaging", itemId] });
      toast.success("Packaging created successfully");
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to create packaging";
      toast.error(errorMessage);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateItemPackagingInput) => {
      if (!packaging) throw new Error("No packaging selected");
      const response = await apiClient.put<{ data: ItemPackaging }>(
        `/api/items/${itemId}/variants/${variantId}/packaging/${packaging.id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-packaging", itemId] });
      toast.success("Packaging updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to update packaging";
      toast.error(errorMessage);
    },
  });

  const onSubmit = (data: FormData) => {
    const payload = {
      packType: data.packType,
      packName: data.packName,
      qtyPerPack: Number(data.qtyPerPack),
      barcode: data.barcode || undefined,
      isActive: data.isActive,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Packaging" : "Create Packaging"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update packaging information"
              : "Add a new packaging option for this variant"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Pack Type */}
          <div className="space-y-2">
            <Label htmlFor="packType">
              Pack Type <span className="text-destructive">*</span>
            </Label>
            <Input
              id="packType"
              {...register("packType", { required: "Pack type is required" })}
              placeholder="e.g., carton, box, dozen"
              disabled={packaging?.isDefault || isPending}
            />
            {errors.packType && (
              <p className="text-sm text-destructive">{errors.packType.message}</p>
            )}
            {packaging?.isDefault && (
              <p className="text-sm text-muted-foreground">Cannot change type of default packaging</p>
            )}
          </div>

          {/* Pack Name */}
          <div className="space-y-2">
            <Label htmlFor="packName">
              Pack Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="packName"
              {...register("packName", { required: "Pack name is required" })}
              placeholder="e.g., Carton of 100, Box of 12"
              disabled={isPending}
            />
            {errors.packName && (
              <p className="text-sm text-destructive">{errors.packName.message}</p>
            )}
          </div>

          {/* Quantity Per Pack */}
          <div className="space-y-2">
            <Label htmlFor="qtyPerPack">
              Quantity Per Pack <span className="text-destructive">*</span>
            </Label>
            <Input
              id="qtyPerPack"
              type="number"
              step="0.01"
              {...register("qtyPerPack", {
                required: "Quantity per pack is required",
                min: { value: 0.01, message: "Must be greater than 0" },
              })}
              placeholder="e.g., 100"
              disabled={isPending}
            />
            {errors.qtyPerPack && (
              <p className="text-sm text-destructive">{errors.qtyPerPack.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Conversion factor to base UOM (e.g., 100 pcs per carton)
            </p>
          </div>

          {/* Barcode */}
          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode (Optional)</Label>
            <Input
              id="barcode"
              {...register("barcode")}
              placeholder="e.g., 1234567890123"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Barcode specific to this packaging type
            </p>
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
              {isEditing ? "Update" : "Create"} Packaging
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
