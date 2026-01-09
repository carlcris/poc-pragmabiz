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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PackagingFormDialog } from "./PackagingFormDialog";

type ItemPackaging = {
  id: string;
  itemId: string;
  packType: string;
  packName: string;
  qtyPerPack: number;
  barcode: string | null;
  isDefault: boolean;
  isActive: boolean;
  uomId: string;
  uom?: string;
};

type PackagingResponse = {
  data: ItemPackaging[];
  total: number;
};

type PackagingTabProps = {
  itemId: string;
  readOnly?: boolean;
};

export const PackagingTab = ({ itemId, readOnly = false }: PackagingTabProps) => {
  const queryClient = useQueryClient();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedPackaging, setSelectedPackaging] = useState<ItemPackaging | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [packagingToDelete, setPackagingToDelete] = useState<ItemPackaging | null>(null);

  // Fetch packaging for item
  const { data: packagingData, isLoading: packagingLoading } = useQuery<PackagingResponse>({
    queryKey: ["item-packaging", itemId],
    queryFn: async () => {
      const response = await apiClient.get<PackagingResponse>(
        `/api/items/${itemId}/packages`
      );
      return response;
    },
  });

  const packaging = packagingData?.data || [];

  // Delete packaging mutation
  const deleteMutation = useMutation({
    mutationFn: async (packagingId: string) => {
      await apiClient.delete(
        `/api/items/${itemId}/packages/${packagingId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-packaging", itemId] });
      toast.success("Packaging deleted successfully");
      setDeleteDialogOpen(false);
      setPackagingToDelete(null);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete packaging";
      toast.error(errorMessage);
    },
  });

  const handleCreatePackaging = () => {
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
                Manage packaging options for this item (e.g., carton, box, dozen)
              </CardDescription>
            </div>
            {!readOnly && (
              <Button onClick={handleCreatePackaging}>
                <Plus className="mr-2 h-4 w-4" />
                Add Packaging
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Packaging List */}
          {packagingLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : packaging.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No packaging options found for this item.</p>
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
                    {!readOnly && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packaging.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-medium">
                        {pkg.packType}
                        {pkg.isDefault && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Base
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
                      {!readOnly && (
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
                              title={pkg.isDefault ? "Cannot delete base packaging" : "Delete packaging"}
                            >
                              <Trash2 className={`h-4 w-4 ${pkg.isDefault ? 'text-muted-foreground' : 'text-destructive'}`} />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
        <PackagingFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          itemId={itemId}
          packaging={selectedPackaging}
        />
      )}

      {!readOnly && (
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
      )}
    </>
  );
};
