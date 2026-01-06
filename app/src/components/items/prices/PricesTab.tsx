"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
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
import { PriceFormDialog } from "./PriceFormDialog";

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

type PricesResponse = {
  data: ItemPrice[];
  total: number;
};

type PricesTabProps = {
  itemId: string;
};

export const PricesTab = ({ itemId }: PricesTabProps) => {
  const queryClient = useQueryClient();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<ItemPrice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priceToDelete, setPriceToDelete] = useState<ItemPrice | null>(null);

  // Fetch prices for item
  const { data: pricesData, isLoading: pricesLoading } = useQuery<PricesResponse>({
    queryKey: ["item-prices", itemId],
    queryFn: async () => {
      const response = await apiClient.get<PricesResponse>(
        `/api/items/${itemId}/prices`
      );
      return response;
    },
  });

  const prices = pricesData?.data || [];

  // Delete price mutation
  const deleteMutation = useMutation({
    mutationFn: async (priceId: string) => {
      await apiClient.delete(
        `/api/items/${itemId}/prices/${priceId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-prices", itemId] });
      toast.success("Price deleted successfully");
      setDeleteDialogOpen(false);
      setPriceToDelete(null);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete price";
      toast.error(errorMessage);
    },
  });

  const handleCreatePrice = () => {
    setSelectedPrice(null);
    setFormDialogOpen(true);
  };

  const handleEditPrice = (price: ItemPrice) => {
    setSelectedPrice(price);
    setFormDialogOpen(true);
  };

  const handleDeletePrice = (price: ItemPrice) => {
    setPriceToDelete(price);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (priceToDelete) {
      deleteMutation.mutate(priceToDelete.id);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Check if price is currently active based on dates
  const isCurrentPrice = (price: ItemPrice) => {
    if (!price.isActive) return false;
    const now = new Date();
    const from = new Date(price.effectiveFrom);
    const to = price.effectiveTo ? new Date(price.effectiveTo) : null;
    return from <= now && (!to || to >= now);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Item Prices</CardTitle>
              <CardDescription>
                Manage multi-tier pricing for this item (e.g., Factory Cost, Wholesale, SRP)
              </CardDescription>
            </div>
            <Button onClick={handleCreatePrice}>
              <Plus className="mr-2 h-4 w-4" />
              Add Price
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Price List */}
          {pricesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : prices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No prices found for this item.</p>
              <p className="text-sm mt-2">Add your first price tier to get started.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Price Tier</TableHead>
                    <TableHead>Tier Name</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Effective To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prices.map((price) => {
                    const isCurrent = isCurrentPrice(price);
                    return (
                      <TableRow key={price.id}>
                        <TableCell className="font-medium font-mono">
                          <div className="flex items-center gap-2">
                            {isCurrent && (
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            )}
                            {price.priceTier.toUpperCase()}
                          </div>
                        </TableCell>
                        <TableCell>{price.priceTierName}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          ₱{price.price.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(price.effectiveFrom)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(price.effectiveTo)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={price.isActive ? "outline" : "secondary"} className={price.isActive ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400" : ""}>
                            {price.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPrice(price)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePrice(price)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PriceFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        itemId={itemId}
        price={selectedPrice}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Price"
        description={
          priceToDelete
            ? `Are you sure you want to delete the price ₱${priceToDelete.price.toFixed(4)} for "${priceToDelete.priceTierName}"? This action cannot be undone.`
            : "Are you sure you want to delete this price?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
};
