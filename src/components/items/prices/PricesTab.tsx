"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
  readOnly?: boolean;
};

export const PricesTab = ({ itemId, readOnly = false }: PricesTabProps) => {
  const t = useTranslations("itemPricesTab");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<ItemPrice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priceToDelete, setPriceToDelete] = useState<ItemPrice | null>(null);

  // Fetch prices for item
  const { data: pricesData, isLoading: pricesLoading } = useQuery<PricesResponse>({
    queryKey: ["item-prices", itemId],
    queryFn: async () => {
      const response = await apiClient.get<PricesResponse>(`/api/items/${itemId}/prices`);
      return response;
    },
  });

  const prices = pricesData?.data || [];

  // Delete price mutation
  const deleteMutation = useMutation({
    mutationFn: async (priceId: string) => {
      await apiClient.delete(`/api/items/${itemId}/prices/${priceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["item-prices", itemId] });
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setPriceToDelete(null);
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : t("deleteError");
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
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
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
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription>{t("description")}</CardDescription>
            </div>
            {!readOnly && (
              <Button onClick={handleCreatePrice}>
                <Plus className="mr-2 h-4 w-4" />
                {t("addPrice")}
              </Button>
            )}
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
            <div className="py-8 text-center text-muted-foreground">
              <p>{t("empty")}</p>
              <p className="mt-2 text-sm">{t("emptyDescription")}</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("priceTier")}</TableHead>
                    <TableHead>{t("tierName")}</TableHead>
                    <TableHead className="text-right">{t("price")}</TableHead>
                    <TableHead>{t("effectiveFrom")}</TableHead>
                    <TableHead>{t("effectiveTo")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    {!readOnly && <TableHead className="text-right">{t("actions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prices.map((price) => {
                    const isCurrent = isCurrentPrice(price);
                    return (
                      <TableRow key={price.id}>
                        <TableCell className="font-mono font-medium">
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
                        <TableCell className="text-sm">{formatDate(price.effectiveFrom)}</TableCell>
                        <TableCell className="text-sm">{formatDate(price.effectiveTo)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={price.isActive ? "outline" : "secondary"}
                            className={
                              price.isActive
                                ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
                                : ""
                            }
                          >
                            {price.isActive ? t("active") : t("inactive")}
                          </Badge>
                        </TableCell>
                        {!readOnly && (
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
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
        <PriceFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          itemId={itemId}
          price={selectedPrice}
        />
      )}

      {!readOnly && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title={t("deleteTitle")}
          description={
            priceToDelete
              ? t("deleteDescriptionWithName", {
                  price: priceToDelete.price.toFixed(4),
                  name: priceToDelete.priceTierName,
                })
              : t("deleteDescription")
          }
          confirmText={tCommon("delete")}
          cancelText={tCommon("cancel")}
          variant="destructive"
          isLoading={deleteMutation.isPending}
        />
      )}
    </>
  );
};
