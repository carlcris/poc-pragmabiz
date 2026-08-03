"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useCustomerSpecialPrices,
  useDeleteCustomerSpecialPrice,
} from "@/hooks/useCustomerPricing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { StatusText } from "@/components/shared/StatusText";
import { CustomerSpecialPriceFormDialog } from "./CustomerSpecialPriceFormDialog";
import type { CustomerItemPrice } from "@/types/customer-pricing";

type CustomerSpecialPricesTabProps = {
  customerId: string;
  enabled: boolean;
};

export const CustomerSpecialPricesTab = ({
  customerId,
  enabled,
}: CustomerSpecialPricesTabProps) => {
  const t = useTranslations("customerSpecialPrices");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<CustomerItemPrice | null>(null);
  const [deletePrice, setDeletePrice] = useState<CustomerItemPrice | null>(null);

  const { data, isLoading, error } = useCustomerSpecialPrices(
    customerId,
    { search: debouncedSearch || undefined, status, page, limit },
    enabled
  );
  const deleteMutation = useDeleteCustomerSpecialPrice(customerId);
  const prices = data?.data || [];
  const canManage = data?.capabilities.canManage ?? false;

  const formatDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatPrice = (price: CustomerItemPrice) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: price.currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price.price);

  const handleCreate = () => {
    setSelectedPrice(null);
    setFormOpen(true);
  };

  const handleEdit = (price: CustomerItemPrice) => {
    setSelectedPrice(price);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletePrice) return;
    try {
      await deleteMutation.mutateAsync(deletePrice.id);
      toast.success(t("deleteSuccess"));
      setDeletePrice(null);
    } catch {
      toast.error(t("deleteError"));
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          {canManage ? (
            <Button type="button" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addPrice")}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={t("searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value: "all" | "active" | "inactive") => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="active">{t("active")}</SelectItem>
                <SelectItem value="inactive">{t("inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("item")}</TableHead>
                  <TableHead>{t("tier")}</TableHead>
                  <TableHead className="text-right">{t("specialPrice")}</TableHead>
                  <TableHead>{t("effectivePeriod")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  {canManage ? (
                    <TableHead className="text-right">{tCommon("actions")}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={canManage ? 6 : 5}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell
                      colSpan={canManage ? 6 : 5}
                      className="py-10 text-center text-destructive"
                    >
                      {t("loadError")}
                    </TableCell>
                  </TableRow>
                ) : prices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 6 : 5} className="py-10 text-center">
                      <p className="font-medium">{t("emptyTitle")}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  prices.map((price) => (
                    <TableRow key={price.id}>
                      <TableCell>
                        <p className="font-medium">{price.itemName}</p>
                        <p className="text-xs text-muted-foreground">{price.itemCode}</p>
                      </TableCell>
                      <TableCell className="tabular-nums font-medium uppercase">
                        {price.priceTier}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(price)}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(price.effectiveFrom)} –{" "}
                        {price.effectiveTo ? formatDate(price.effectiveTo) : t("noEndDate")}
                      </TableCell>
                      <TableCell>
                        <StatusText tone={price.isActive ? "green" : "muted"}>
                          {t(price.isActive ? "active" : "inactive")}
                        </StatusText>
                      </TableCell>
                      {canManage ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(price)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              {tCommon("edit")}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={tCommon("actions")}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeletePrice(price)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {tCommon("delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.pagination.total > 0 ? (
            <DataTablePagination
              currentPage={data.pagination.page}
              totalPages={Math.max(1, data.pagination.totalPages)}
              pageSize={data.pagination.limit}
              totalItems={data.pagination.total}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
              pageSizeOptions={[10, 20, 50]}
            />
          ) : null}
        </CardContent>
      </Card>

      <CustomerSpecialPriceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customerId={customerId}
        price={selectedPrice}
      />

      <ConfirmDialog
        open={Boolean(deletePrice)}
        onOpenChange={(open) => {
          if (!open) setDeletePrice(null);
        }}
        onConfirm={handleDelete}
        title={t("deleteTitle")}
        description={
          deletePrice
            ? t("deleteDescription", {
                tier: deletePrice.priceTier.toUpperCase(),
                item: deletePrice.itemName,
              })
            : ""
        }
        confirmText={tCommon("delete")}
        cancelText={tCommon("cancel")}
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
};
