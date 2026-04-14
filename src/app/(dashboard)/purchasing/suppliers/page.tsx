"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Search, Pencil, Filter, Package, Trash2, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { useSuppliers, useDeleteSupplier } from "@/hooks/useSuppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientOnly } from "@/components/shared/ClientOnly";
import { StatusText } from "@/components/shared/StatusText";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { useCurrency } from "@/hooks/useCurrency";
import type { Supplier } from "@/types/supplier";

const SupplierFormDialog = dynamic(
  () => import("@/components/suppliers/SupplierFormDialog").then((mod) => mod.SupplierFormDialog),
  { ssr: false }
);

export default function SuppliersPage() {
  const router = useRouter();
  const t = useTranslations("suppliersPage");
  const tCommon = useTranslations("common");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const { formatCurrency } = useCurrency();
  const deleteMutation = useDeleteSupplier();

  const { data, isLoading, error } = useSuppliers({
    search,
    status: statusFilter as Supplier["status"] | "all",
    page,
    limit: pageSize,
  });

  const suppliers = data?.data || [];
  const pagination = data?.pagination;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const getStatusBadge = (status: Supplier["status"]) => {
    switch (status) {
      case "active":
        return <StatusText tone="green">{t("statusActive")}</StatusText>;
      case "inactive":
        return <StatusText tone="muted">{t("statusInactive")}</StatusText>;
      case "blacklisted":
        return <StatusText tone="red">{t("statusBlacklisted")}</StatusText>;
      default:
        return <StatusText>{status}</StatusText>;
    }
  };

  const getPaymentTermsLabel = (terms: string) => {
    const labels: Record<string, string> = {
      cod: t("paymentCod"),
      net_7: t("paymentNet7"),
      net_15: t("paymentNet15"),
      net_30: t("paymentNet30"),
      net_45: t("paymentNet45"),
      net_60: t("paymentNet60"),
      net_90: t("paymentNet90"),
    };
    return labels[terms] || terms;
  };

  const handleCreateSupplier = () => {
    setSelectedSupplier(null);
    setDialogOpen(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDialogOpen(true);
  };

  const handleViewSupplier = (supplier: Supplier) => {
    router.push(`/purchasing/suppliers/${supplier.id}`);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleDeleteSupplier = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const getErrorMessage = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  const confirmDelete = async () => {
    if (!supplierToDelete) return;

    try {
      await deleteMutation.mutateAsync(supplierToDelete.id);
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err, t("deleteError")));
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">{t("title")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={handleCreateSupplier} className="w-full sm:w-auto flex-shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          {t("createSupplier")}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
              className="pl-8"
            />
          </div>
          <ClientOnly fallback={<Skeleton className="h-10 w-full sm:w-[180px]" />}>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("statusPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatus")}</SelectItem>
                <SelectItem value="active">{t("statusActive")}</SelectItem>
                <SelectItem value="inactive">{t("statusInactive")}</SelectItem>
                <SelectItem value="blacklisted">{t("statusBlacklisted")}</SelectItem>
              </SelectContent>
            </Select>
          </ClientOnly>
        </div>

        <div className="min-h-0 flex-1">
          {isLoading ? (
            <div className="h-full overflow-auto overscroll-contain rounded-md border">
              <Table className="min-w-[1100px]">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm [&_th]:bg-background">
                  <TableRow>
                    <TableHead>{t("code")}</TableHead>
                    <TableHead>{t("supplier")}</TableHead>
                    <TableHead>{t("contactPerson")}</TableHead>
                    <TableHead>{t("contactInfo")}</TableHead>
                    <TableHead>{t("location")}</TableHead>
                    <TableHead>{t("paymentTerms")}</TableHead>
                    <TableHead className="text-right">{t("creditLimit")}</TableHead>
                    <TableHead className="text-right">{t("balance")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(8)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-center text-destructive">
              {t("loadError")}
            </div>
          ) : suppliers.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <EmptyStatePanel
                icon={Package}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
              />
            </div>
          ) : (
            <div className="h-full overflow-auto overscroll-contain rounded-md border">
              <Table className="min-w-[1100px]">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm [&_th]:bg-background">
                  <TableRow>
                    <TableHead>{t("code")}</TableHead>
                    <TableHead>{t("supplier")}</TableHead>
                    <TableHead>{t("contactPerson")}</TableHead>
                    <TableHead>{t("contactInfo")}</TableHead>
                    <TableHead>{t("location")}</TableHead>
                    <TableHead>{t("paymentTerms")}</TableHead>
                    <TableHead className="text-right">{t("creditLimit")}</TableHead>
                    <TableHead className="text-right">{t("balance")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow
                      key={supplier.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewSupplier(supplier)}
                    >
                      <TableCell className="font-medium">{supplier.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium">{supplier.name}</div>
                            <div className="text-xs text-muted-foreground">{supplier.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{supplier.contactPerson}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{supplier.phone}</div>
                        {supplier.mobile && (
                          <div className="text-xs text-muted-foreground">{supplier.mobile}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {supplier.billingCity}, {supplier.billingState}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {supplier.billingCountry}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getPaymentTermsLabel(supplier.paymentTerms)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {supplier.creditLimit ? formatCurrency(supplier.creditLimit) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            supplier.currentBalance > 0 ? "font-medium text-orange-600" : ""
                          }
                        >
                          {formatCurrency(supplier.currentBalance)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(supplier.status)}</TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditSupplier(supplier)}
                            aria-label={t("editSupplier")}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>{tCommon("edit")}</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                aria-label={tCommon("actions")}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleDeleteSupplier(supplier)}
                                disabled={deleteMutation.isPending}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>{tCommon("delete")}</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {!isLoading && suppliers.length > 0 && pagination && pagination.total > 0 && (
          <div className="mt-4">
            <DataTablePagination
              currentPage={page}
              totalPages={pagination.totalPages}
              pageSize={pageSize}
              totalItems={pagination.total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {dialogOpen && (
        <SupplierFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          supplier={selectedSupplier}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { name: supplierToDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
