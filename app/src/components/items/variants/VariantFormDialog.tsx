"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ItemVariant, CreateItemVariantInput, UpdateItemVariantInput } from "@/types/item-variant";

type VariantFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  variant?: ItemVariant | null;
};

type FormData = {
  variantCode: string;
  variantName: string;
  description: string;
  isActive: boolean;
};

export const VariantFormDialog = ({ open, onOpenChange, itemId, variant }: VariantFormDialogProps) => {
  const queryClient = useQueryClient();
  const isEditing = !!variant;
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrValue, setNewAttrValue] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      variantCode: "",
      variantName: "",
      description: "",
      isActive: true,
    },
  });

  const isActive = watch("isActive");

  // Initialize form when variant changes
  useEffect(() => {
    if (variant) {
      setValue("variantCode", variant.variantCode);
      setValue("variantName", variant.variantName);
      setValue("description", variant.description || "");
      setValue("isActive", variant.isActive);

      // Convert attributes to string key-value pairs
      const stringAttributes: Record<string, string> = {};
      Object.entries(variant.attributes).forEach(([key, value]) => {
        stringAttributes[key] = String(value);
      });
      setAttributes(stringAttributes);
    } else {
      reset();
      setAttributes({});
    }
    setNewAttrKey("");
    setNewAttrValue("");
  }, [variant, reset, setValue]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateItemVariantInput) => {
      const response = await apiClient.post<{ data: ItemVariant }>(
        `/api/items/${itemId}/variants`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-variants", itemId] });
      toast.success("Variant created successfully");
      onOpenChange(false);
      reset();
      setAttributes({});
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to create variant";
      toast.error(errorMessage);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateItemVariantInput) => {
      if (!variant) throw new Error("No variant selected");
      const response = await apiClient.put<{ data: ItemVariant }>(
        `/api/items/${itemId}/variants/${variant.id}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-variants", itemId] });
      toast.success("Variant updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to update variant";
      toast.error(errorMessage);
    },
  });

  const onSubmit = (data: FormData) => {
    const payload = {
      variantCode: data.variantCode,
      variantName: data.variantName,
      description: data.description || undefined,
      attributes,
      isActive: data.isActive,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleAddAttribute = () => {
    if (!newAttrKey.trim() || !newAttrValue.trim()) {
      toast.error("Both attribute key and value are required");
      return;
    }

    if (attributes[newAttrKey]) {
      toast.error("Attribute key already exists");
      return;
    }

    setAttributes({ ...attributes, [newAttrKey]: newAttrValue });
    setNewAttrKey("");
    setNewAttrValue("");
  };

  const handleRemoveAttribute = (key: string) => {
    const newAttributes = { ...attributes };
    delete newAttributes[key];
    setAttributes(newAttributes);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Variant" : "Create Variant"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update variant information and attributes"
              : "Add a new variant for this item"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Variant Code */}
          <div className="space-y-2">
            <Label htmlFor="variantCode">
              Variant Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="variantCode"
              {...register("variantCode", { required: "Variant code is required" })}
              placeholder="e.g., 8X12, SMALL, RED"
              disabled={variant?.isDefault || isPending}
            />
            {errors.variantCode && (
              <p className="text-sm text-destructive">{errors.variantCode.message}</p>
            )}
            {variant?.isDefault && (
              <p className="text-sm text-muted-foreground">Cannot change code of default variant</p>
            )}
          </div>

          {/* Variant Name */}
          <div className="space-y-2">
            <Label htmlFor="variantName">
              Variant Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="variantName"
              {...register("variantName", { required: "Variant name is required" })}
              placeholder="e.g., 8x12 inches, Small, Red"
              disabled={isPending}
            />
            {errors.variantName && (
              <p className="text-sm text-destructive">{errors.variantName.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Optional variant description"
              rows={3}
              disabled={isPending}
            />
          </div>

          {/* Attributes */}
          <div className="space-y-2">
            <Label>Attributes</Label>
            <div className="border rounded-md p-3 space-y-3">
              {/* Existing attributes */}
              {Object.entries(attributes).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(attributes).map(([key, value]) => (
                    <Badge key={key} variant="secondary" className="pr-1">
                      <span className="mr-1">
                        {key}: {value}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => handleRemoveAttribute(key)}
                        disabled={isPending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Add new attribute */}
              <div className="flex gap-2">
                <Input
                  placeholder="Attribute (e.g., size, color)"
                  value={newAttrKey}
                  onChange={(e) => setNewAttrKey(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddAttribute())}
                  disabled={isPending}
                />
                <Input
                  placeholder="Value (e.g., 8x12, red)"
                  value={newAttrValue}
                  onChange={(e) => setNewAttrValue(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddAttribute())}
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddAttribute}
                  disabled={isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add custom attributes like size, color, dimensions, etc.
              </p>
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
              {isEditing ? "Update" : "Create"} Variant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
