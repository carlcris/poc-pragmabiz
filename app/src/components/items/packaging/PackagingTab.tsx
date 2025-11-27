"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PackagingFormDialog } from "./PackagingFormDialog";
import type { ItemVariant, VariantsResponse, ItemPackaging, PackagingResponse } from "@/types/item-variant";

type PackagingTabProps = {
  itemId: string;
};

export const PackagingTab = ({ itemId }: PackagingTabProps) => {
  const queryClient = useQueryClient();
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedPackaging, setSelectedPackaging] = useState<ItemPackaging | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [packagingToDelete, setPackagingToDelete] = useState<ItemPackaging | null>(null);

  // Fetch variants for selection
  const { data: variantsData, isLoading: variantsLoading } = useQuery<VariantsResponse>({
    queryKey: ["item-variants", itemId],
    queryFn: async () => {
      const response = await apiClient.get<VariantsResponse>(
        `/api/items/${itemId}/variants`
      );
      return response;
    },
  });

  const variants = variantsData?.data || [];

  // Auto-select first variant when variants load
  if (variants.length > 0 && !selectedVariantId) {
    setSelectedVariantId(variants[0].id);
  }

  // Fetch packaging for selected variant
  const { data: packagingData, isLoading: packagingLoading } = useQuery<PackagingResponse>({
    queryKey: ["item-packaging", itemId, selectedVariantId],
    queryFn: async () => {
      if (!selectedVariantId) return { data: [], total: 0 };
      const response = await apiClient.get<PackagingResponse>(
        `/api/items/${itemId}/variants/${selectedVariantId}/packaging`
      );
      return response;
    },
    enabled: !!selectedVariantId,
  });

  const packaging = packagingData?.data || [];

  // Delete packaging mutation
  const deleteMutation = useMutation({
    mutationFn: async (packagingId: string) => {
      if (!selectedVariantId) throw new Error("No variant selected");
      await apiClient.delete(
        `/api/items/${itemId}/variants/${selectedVariantId}/packaging/${packagingId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-packaging", itemId, selectedVariantId] });
      toast.success("Packaging deleted successfully");
      setDeleteDialogOpen(false);
      setPackagingToDelete(null);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete packaging";
      toast.error(errorMessage);
    },
  });

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);

  const handleCreatePackaging = () => {
    if (!selectedVariantId) {
      toast.error("Please select a variant first");
      return;
    }
    setSelectedPackaging(null);
    setFormDialogOpen(true);
  };

  const handleEditPackaging = (pkg: ItemPackaging) => {
    setSelectedPackaging(pkg);
    setFormDialogOpen(true);
  };

  const handleDeletePackaging = (pkg: ItemPackaging) => {
    setPackagingToDelete(pkg);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (packagingToDelete) {
      deleteMutation.mutate(packagingToDelete.id);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Item Packaging</CardTitle>
              <CardDescription>
                Manage packaging options for item variants (e.g., carton, box, dozen)
              </CardDescription>
            </div>
            <Button onClick={handleCreatePackaging} disabled={!selectedVariantId}>
              <Plus className="mr-2 h-4 w-4" />
              Add Packaging
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Variant Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Variant</label>
            {variantsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : variants.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No variants found. Please create a variant first.
              </div>
            ) : (
              <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a variant" />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.variantName} ({variant.variantCode})
                      {variant.isDefault && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Default
                        </Badge>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Packaging List */}
          {!selectedVariantId ? (
            <div className="text-center py-8 text-muted-foreground">
              Select a variant to view its packaging options
            </div>
          ) : packagingLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : packaging.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No packaging options found for this variant.</p>
              <p className="text-sm mt-2">Add your first packaging option to get started.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pack Type</TableHead>
                    <TableHead>Pack Name</TableHead>
                    <TableHead className="text-right">Qty Per Pack</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packaging.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-medium">
                        {pkg.packType}
                        {pkg.isDefault && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Default
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{pkg.packName}</TableCell>
                      <TableCell className="text-right font-mono">
                        {pkg.qtyPerPack.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {pkg.barcode || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={pkg.isActive ? "outline" : "secondary"} className={pkg.isActive ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400" : ""}>
                          {pkg.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPackaging(pkg)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePackaging(pkg)}
                            disabled={pkg.isDefault || deleteMutation.isPending}
                            title={pkg.isDefault ? "Cannot delete default packaging" : "Delete packaging"}
                          >
                            <Trash2 className={`h-4 w-4 ${pkg.isDefault ? 'text-muted-foreground' : 'text-destructive'}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedVariantId && (
        <PackagingFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          itemId={itemId}
          variantId={selectedVariantId}
          packaging={selectedPackaging}
        />
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Packaging"
        description={
          packagingToDelete
            ? `Are you sure you want to delete "${packagingToDelete.packName}"? This action cannot be undone.`
            : "Are you sure you want to delete this packaging?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
};
