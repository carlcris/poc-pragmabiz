"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { VariantFormDialog } from "./VariantFormDialog";
import type { ItemVariant, VariantsResponse } from "@/types/item-variant";

type VariantsTabProps = {
  itemId: string;
};

export const VariantsTab = ({ itemId }: VariantsTabProps) => {
  const queryClient = useQueryClient();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ItemVariant | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<ItemVariant | null>(null);

  // Fetch variants
  const { data, isLoading, error } = useQuery<VariantsResponse>({
    queryKey: ["item-variants", itemId],
    queryFn: async () => {
      const response = await apiClient.get<VariantsResponse>(
        `/api/items/${itemId}/variants`
      );
      return response;
    },
  });

  // Delete variant mutation
  const deleteMutation = useMutation({
    mutationFn: async (variantId: string) => {
      await apiClient.delete(`/api/items/${itemId}/variants/${variantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-variants", itemId] });
      toast.success("Variant deleted successfully");
      setDeleteDialogOpen(false);
      setVariantToDelete(null);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete variant";
      toast.error(errorMessage);
    },
  });

  const variants = data?.data || [];

  const handleCreateVariant = () => {
    setSelectedVariant(null);
    setFormDialogOpen(true);
  };

  const handleEditVariant = (variant: ItemVariant) => {
    setSelectedVariant(variant);
    setFormDialogOpen(true);
  };

  const handleDeleteVariant = (variant: ItemVariant) => {
    setVariantToDelete(variant);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (variantToDelete) {
      deleteMutation.mutate(variantToDelete.id);
    }
  };

  const renderAttributes = (attributes: Record<string, unknown>) => {
    const entries = Object.entries(attributes);
    if (entries.length === 0) return <span className="text-muted-foreground">-</span>;

    return (
      <div className="flex flex-wrap gap-1">
        {entries.map(([key, value]) => (
          <Badge key={key} variant="outline" className="text-xs">
            {key}: {String(value)}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Item Variants</CardTitle>
              <CardDescription>
                Manage different variations of this item (e.g., size, color, dimensions)
              </CardDescription>
            </div>
            <Button onClick={handleCreateVariant}>
              <Plus className="mr-2 h-4 w-4" />
              Add Variant
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 flex-1" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <p className="font-semibold">Error loading variants</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : "Failed to load variants"}
              </p>
            </div>
          ) : variants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No variants found for this item.</p>
              <p className="text-sm mt-2">Create your first variant to get started.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant Code</TableHead>
                    <TableHead>Variant Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Attributes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((variant) => (
                    <TableRow key={variant.id}>
                      <TableCell className="font-mono font-medium">
                        {variant.variantCode}
                        {variant.isDefault && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Default
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{variant.variantName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {variant.description || "-"}
                      </TableCell>
                      <TableCell>{renderAttributes(variant.attributes)}</TableCell>
                      <TableCell>
                        <Badge variant={variant.isActive ? "outline" : "secondary"} className={variant.isActive ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400" : ""}>
                          {variant.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditVariant(variant)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteVariant(variant)}
                            disabled={variant.isDefault || deleteMutation.isPending}
                            title={variant.isDefault ? "Cannot delete default variant" : "Delete variant"}
                          >
                            <Trash2 className={`h-4 w-4 ${variant.isDefault ? 'text-muted-foreground' : 'text-destructive'}`} />
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

      <VariantFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        itemId={itemId}
        variant={selectedVariant}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Variant"
        description={
          variantToDelete
            ? `Are you sure you want to delete variant "${variantToDelete.variantName}"? This action cannot be undone.`
            : "Are you sure you want to delete this variant?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
};
