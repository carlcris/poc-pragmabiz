"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Plus, Search, Pencil, Filter, Building2, User, Landmark, Trash2 } from "lucide-react";
import { useCustomers, useDeleteCustomer } from "@/hooks/useCustomers";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { CreateGuard, EditGuard, DeleteGuard } from "@/components/permissions/PermissionGuard";
import { RESOURCES } from "@/constants/resources";
import { useCurrency } from "@/hooks/useCurrency";
import type { Customer } from "@/types/customer";

const CustomerFormDialog = dynamic(
  () => import("@/components/customers/CustomerFormDialog").then((mod) => mod.CustomerFormDialog),
  { ssr: false }
);
const ConfirmDialog = dynamic(
  () => import("@/components/shared/ConfirmDialog").then((mod) => mod.ConfirmDialog),
  { ssr: false }
);

function CustomersPageContent() {
  const t = useTranslations("customersPage");
  const tCommon = useTranslations("common");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const { formatCurrency } = useCurrency();
  const deleteCustomer = useDeleteCustomer();

  const { data, isLoading, error } = useCustomers({
    search,
    customerType: typeFilter as Customer["customerType"] | "all",
    isActive: statusFilter === "all" ? undefined : statusFilter === "active",
    page,
    limit: pageSize,
  });

  const customers = data?.data || [];
  const pagination = data?.pagination;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const getCustomerTypeIcon = (type: Customer["customerType"]) => {
    switch (type) {
      case "company":
        return <Building2 className="h-4 w-4 text-blue-600" />;
      case "government":
        return <Landmark className="h-4 w-4 text-purple-600" />;
      default:
        return <User className="h-4 w-4 text-green-600" />;
    }
  };

  const getCustomerTypeBadge = (type: Customer["customerType"]) => {
    switch (type) {
      case "company":
        return <Badge variant="default">{t("typeCompany")}</Badge>;
      case "government":
        return <Badge className="bg-purple-600 hover:bg-purple-700">{t("typeGovernment")}</Badge>;
      default:
        return <Badge variant="secondary">{t("typeIndividual")}</Badge>;
    }
  };

  const handleCreateCustomer = () => {
    setSelectedCustomer(null);
    setDialogOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDialogOpen(true);
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;

    try {
      await deleteCustomer.mutateAsync(customerToDelete.id);
      toast.success(t("deleteSuccess"));
      setCustomerToDelete(null);
    } catch {
      toast.error(t("deleteError"));
    }
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <CreateGuard resource={RESOURCES.CUSTOMERS}>
          <Button onClick={handleCreateCustomer}>
            <Plus className="mr-2 h-4 w-4" />
            {t("createCustomer")}
          </Button>
        </CreateGuard>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
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
          <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder={t("typePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              <SelectItem value="individual">{t("typeIndividual")}</SelectItem>
              <SelectItem value="company">{t("typeCompany")}</SelectItem>
              <SelectItem value="government">{t("typeGovernment")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[150px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder={tCommon("status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tCommon("allStatuses")}</SelectItem>
              <SelectItem value="active">{tCommon("active")}</SelectItem>
              <SelectItem value="inactive">{tCommon("inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("typePlaceholder")}</TableHead>
                  <TableHead>{t("contact")}</TableHead>
                  <TableHead>{t("location")}</TableHead>
                  <TableHead className="text-right">{t("creditLimit")}</TableHead>
                  <TableHead className="text-right">{t("balance")}</TableHead>
                  <TableHead>{tCommon("status")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4" />
                        <div className="flex-1">
                          <Skeleton className="mb-2 h-4 w-32" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="mb-2 h-4 w-28" />
                      <Skeleton className="h-3 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="mb-2 h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            {t("loadError")}
          </div>
        ) : customers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("empty")}</div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>{t("customer")}</TableHead>
                    <TableHead>{t("typePlaceholder")}</TableHead>
                    <TableHead>{t("contact")}</TableHead>
                    <TableHead>{t("location")}</TableHead>
                    <TableHead className="text-right">{t("creditLimit")}</TableHead>
                    <TableHead className="text-right">{t("balance")}</TableHead>
                    <TableHead>{tCommon("status")}</TableHead>
                    <TableHead className="text-right">{tCommon("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getCustomerTypeIcon(customer.customerType)}
                          <div>
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-xs text-muted-foreground">{customer.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getCustomerTypeBadge(customer.customerType)}</TableCell>
                      <TableCell>
                        <div className="text-sm">{customer.phone}</div>
                        {customer.contactPersonName && (
                          <div className="text-xs text-muted-foreground">
                            {customer.contactPersonName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {customer.billingCity}, {customer.billingState}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {customer.billingCountry}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(customer.creditLimit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            customer.currentBalance > 0 ? "font-medium text-orange-600" : ""
                          }
                        >
                          {formatCurrency(customer.currentBalance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={customer.isActive ? "outline" : "secondary"}
                          className={
                            customer.isActive
                              ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
                              : ""
                          }
                        >
                          {customer.isActive ? tCommon("active") : tCommon("inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <EditGuard resource={RESOURCES.CUSTOMERS}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCustomer(customer)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </EditGuard>
                          <DeleteGuard resource={RESOURCES.CUSTOMERS}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCustomer(customer)}
                              disabled={deleteCustomer.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </DeleteGuard>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {pagination && pagination.total > 0 && (
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
          </>
        )}
      </div>

      {dialogOpen && (
        <CustomerFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          customer={selectedCustomer}
        />
      )}

      {deleteDialogOpen && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title={t("deleteTitle")}
          description={
            customerToDelete
              ? t("deleteDescriptionWithName", { name: customerToDelete.name })
              : t("deleteDescription")
          }
          confirmText={tCommon("delete")}
          cancelText={tCommon("cancel")}
          variant="destructive"
          isLoading={deleteCustomer.isPending}
        />
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <ProtectedRoute resource={RESOURCES.CUSTOMERS}>
      <CustomersPageContent />
    </ProtectedRoute>
  );
}
