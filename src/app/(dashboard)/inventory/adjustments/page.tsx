"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  CheckCircle,
  FileText,
  Clock,
  XCircle,
  Calculator,
} from "lucide-react";
import {
  useStockAdjustments,
  useCreateStockAdjustment,
  useUpdateStockAdjustment,
  useDeleteStockAdjustment,
  usePostStockAdjustment,
} from "@/hooks/useStockAdjustments";
import { useWarehouses } from "@/hooks/useWarehouses";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type {
  StockAdjustment,
  StockAdjustmentType,
  StockAdjustmentStatus,
} from "@/types/stock-adjustment";
import type { WarehouseLocation } from "@/types/inventory-location";
import { useAuthStore } from "@/stores/authStore";
import { useCurrency } from "@/hooks/useCurrency";
import {
  StockAdjustmentLineItemDialog,
  type StockAdjustmentLineItemFormValues,
} from "@/components/stock-adjustments/StockAdjustmentLineItemDialog";
import { supabase } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api";

const adjustmentFormSchema = z.object({
  adjustmentType: z.enum(["physical_count", "damage", "loss", "found", "quality_issue", "other"]),
  adjustmentDate: z.string().min(1, "Adjustment date is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  locationId: z.string().optional(),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
});

type AdjustmentFormValues = z.infer<typeof adjustmentFormSchema>;

export default function StockAdjustmentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState<StockAdjustment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adjustmentToDelete, setAdjustmentToDelete] = useState<StockAdjustment | null>(null);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [adjustmentToPost, setAdjustmentToPost] = useState<StockAdjustment | null>(null);

  // Line items state (similar to sales orders)
  const [lineItems, setLineItems] = useState<StockAdjustmentLineItemFormValues[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: StockAdjustmentLineItemFormValues;
  } | null>(null);

  const user = useAuthStore((state) => state.user);
  const companyId = user?.companyId || "";
  const { formatCurrency } = useCurrency();

  const { data, isLoading, error } = useStockAdjustments({
    search,
    page: 1,
    limit: 1000,
  });

  const { data: warehousesData } = useWarehouses({ page: 1, limit: 1000 });

  const warehouses = warehousesData?.data || [];

  const createMutation = useCreateStockAdjustment();
  const updateMutation = useUpdateStockAdjustment();
  const deleteMutation = useDeleteStockAdjustment();
  const postMutation = usePostStockAdjustment();

  // Client-side filtering
  let filteredAdjustments = data?.data || [];

  if (statusFilter !== "all") {
    filteredAdjustments = filteredAdjustments.filter((a) => a.status === statusFilter);
  }

  if (typeFilter !== "all") {
    filteredAdjustments = filteredAdjustments.filter((a) => a.adjustmentType === typeFilter);
  }

  // Pagination
  const total = filteredAdjustments.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const adjustments = filteredAdjustments.slice(start, end);

  const pagination = {
    total,
    page,
    limit: pageSize,
    totalPages,
  };

  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentFormSchema),
    defaultValues: {
      adjustmentType: "physical_count",
      adjustmentDate: new Date().toISOString().split("T")[0],
      warehouseId: "",
      locationId: "",
      reason: "",
      notes: "",
    },
  });

  // Calculate total adjustment value
  const totals = useMemo(() => {
    const totalValue = lineItems.reduce((sum, item) => {
      const difference = (item.adjustedQty || 0) - (item.currentQty || 0);
      const value = difference * (item.unitCost || 0);
      return sum + value;
    }, 0);

    return { totalValue };
  }, [lineItems]);

  // Reset form and line items when dialog opens/closes
  useEffect(() => {
    if (dialogOpen && selectedAdjustment) {
      form.reset({
        adjustmentType: selectedAdjustment.adjustmentType,
        adjustmentDate: selectedAdjustment.adjustmentDate,
        warehouseId: selectedAdjustment.warehouseId,
        locationId: selectedAdjustment.locationId || "",
        reason: selectedAdjustment.reason,
        notes: selectedAdjustment.notes || "",
      });
      // Convert adjustment items to form format
      const formLineItems: StockAdjustmentLineItemFormValues[] = selectedAdjustment.items.map(
        (item) => ({
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          uomId: item.uomId,
          currentQty: item.currentQty,
          adjustedQty: item.adjustedQty,
          unitCost: item.unitCost,
        })
      );
      setLineItems(formLineItems);
    } else if (dialogOpen) {
      form.reset({
        adjustmentType: "physical_count",
        adjustmentDate: new Date().toISOString().split("T")[0],
        warehouseId: "",
        locationId: "",
        reason: "",
        notes: "",
      });
      setLineItems([]);
    }
  }, [dialogOpen, selectedAdjustment, form]);

  const selectedWarehouseId = form.watch("warehouseId");

  useEffect(() => {
    if (!selectedWarehouseId) {
      form.setValue("locationId", "");
    }
  }, [selectedWarehouseId, form]);

  const { data: locationsData } = useQuery<{ data: WarehouseLocation[] }>({
    queryKey: ["warehouse-locations", selectedWarehouseId],
    queryFn: () => apiClient.get(`/api/warehouses/${selectedWarehouseId}/locations`),
    enabled: !!selectedWarehouseId,
  });

  const locations = useMemo(
    () => (locationsData?.data || []).filter((location) => location.isActive),
    [locationsData]
  );

  const getStatusBadge = (status: StockAdjustmentStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "pending":
        return (
          <Badge variant="default" className="bg-yellow-600">
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="bg-blue-600">
            Approved
          </Badge>
        );
      case "posted":
        return (
          <Badge variant="default" className="bg-green-600">
            Posted
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
    }
  };

  const getStatusIcon = (status: StockAdjustmentStatus) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4 text-gray-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "posted":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getTypeLabel = (type: StockAdjustmentType) => {
    switch (type) {
      case "physical_count":
        return "Physical Count";
      case "damage":
        return "Damage";
      case "loss":
        return "Loss";
      case "found":
        return "Found";
      case "quality_issue":
        return "Quality Issue";
      case "other":
        return "Other";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleCreateAdjustment = () => {
    setSelectedAdjustment(null);
    setLineItems([]);
    setDialogOpen(true);
  };

  const handleEditAdjustment = (adjustment: StockAdjustment) => {
    setSelectedAdjustment(adjustment);
    setDialogOpen(true);
  };

  const handleDeleteAdjustment = (adjustment: StockAdjustment) => {
    setAdjustmentToDelete(adjustment);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!adjustmentToDelete) return;

    await deleteMutation.mutateAsync(adjustmentToDelete.id);
    setDeleteDialogOpen(false);
    setAdjustmentToDelete(null);
  };

  const handlePostAdjustment = (adjustment: StockAdjustment) => {
    setAdjustmentToPost(adjustment);
    setPostDialogOpen(true);
  };

  const handleConfirmPost = async () => {
    if (!adjustmentToPost) return;

    await postMutation.mutateAsync({ id: adjustmentToPost.id });
    setPostDialogOpen(false);
    setAdjustmentToPost(null);
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setItemDialogOpen(true);
  };

  const handleEditItem = (index: number) => {
    setEditingItem({ index, item: lineItems[index] });
    setItemDialogOpen(true);
  };

  const handleDeleteItem = (index: number) => {
    setLineItems((items) => items.filter((_, i) => i !== index));
  };

  const handleSaveItem = (item: StockAdjustmentLineItemFormValues) => {
    if (editingItem !== null) {
      // Update existing item
      setLineItems((items) => items.map((it, i) => (i === editingItem.index ? item : it)));
    } else {
      // Add new item
      setLineItems((items) => [...items, item]);
    }
  };

  const handleFetchStockQty = async (
    itemId: string,
    warehouseId: string,
    locationId?: string
  ): Promise<number> => {
    try {
      if (locationId) {
        const { data, error } = await supabase
          .from("item_location")
          .select("qty_on_hand")
          .eq("item_id", itemId)
          .eq("warehouse_id", warehouseId)
          .eq("location_id", locationId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (error) {
          return 0;
        }

        return data ? parseFloat(data.qty_on_hand) : 0;
      }

      // Fallback to warehouse-level stock when location is not selected
      const { data, error } = await supabase
        .from("item_warehouse")
        .select("current_stock")
        .eq("item_id", itemId)
        .eq("warehouse_id", warehouseId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) {
        return 0;
      }

      return data ? parseFloat(data.current_stock) : 0;
    } catch {
      return 0;
    }
  };

  const onSubmit = async (values: AdjustmentFormValues) => {
    if (lineItems.length === 0) {
      alert("Please add at least one line item");
      return;
    }

    try {
      const submitData = {
        ...values,
        companyId,
        items: lineItems.map((item) => ({
          itemId: item.itemId,
          currentQty: item.currentQty,
          adjustedQty: item.adjustedQty,
          unitCost: item.unitCost,
          uomId: item.uomId,
        })),
      };

      if (selectedAdjustment) {
        await updateMutation.mutateAsync({
          id: selectedAdjustment.id,
          data: submitData,
        });
      } else {
        await createMutation.mutateAsync(submitData);
      }
      setDialogOpen(false);
      setLineItems([]);
      form.reset();
    } catch {}
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    setPage(1);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">Stock Adjustments</h1>
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Manage stock corrections and adjustments</p>
          </div>
          <Button onClick={handleCreateAdjustment} className="w-full sm:w-auto flex-shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Create Adjustment
          </Button>
        </div>

        <div className="space-y-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search adjustments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="physical_count">Physical Count</SelectItem>
                <SelectItem value="damage">Damage</SelectItem>
                <SelectItem value="loss">Loss</SelectItem>
                <SelectItem value="found">Found</SelectItem>
                <SelectItem value="quality_issue">Quality Issue</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Adjustment #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(8)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24 rounded-full" />
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
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              Error loading stock adjustments. Please try again.
            </div>
          ) : adjustments.length === 0 ? (
            <EmptyStatePanel
              icon={Calculator}
              title="No stock adjustments found"
              description="Create your first adjustment to get started."
            />
          ) : (
            <>
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Adjustment #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustments.map((adjustment) => (
                      <TableRow key={adjustment.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(adjustment.status)}
                            {adjustment.adjustmentCode}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getTypeLabel(adjustment.adjustmentType)}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(adjustment.adjustmentDate)}</TableCell>
                        <TableCell>{adjustment.warehouseName}</TableCell>
                        <TableCell>
                          {adjustment.locationCode && adjustment.locationName
                            ? `${adjustment.locationCode} - ${adjustment.locationName}`
                            : adjustment.locationCode || adjustment.locationName || "--"}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate">{adjustment.reason}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className={
                              adjustment.totalValue >= 0 ? "text-green-600" : "text-red-600"
                            }
                          >
                            {formatCurrency(adjustment.totalValue)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {adjustment.items.length} item{adjustment.items.length !== 1 ? "s" : ""}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(adjustment.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {adjustment.status === "draft" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditAdjustment(adjustment)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAdjustment(adjustment)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handlePostAdjustment(adjustment)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="mr-1 h-4 w-4" />
                                  Post
                                </Button>
                              </>
                            )}
                            {adjustment.status === "posted" && adjustment.stockTransactionCode && (
                              <Badge variant="outline" className="text-xs">
                                {adjustment.stockTransactionCode}
                              </Badge>
                            )}
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

        {/* Form Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedAdjustment ? "Edit Stock Adjustment" : "Create Stock Adjustment"}
              </DialogTitle>
              <DialogDescription>
                {selectedAdjustment
                  ? `Edit adjustment ${selectedAdjustment.adjustmentCode}`
                  : "Create a new stock adjustment"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* General Info Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">General Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="adjustmentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adjustment Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="physical_count">Physical Count</SelectItem>
                              <SelectItem value="damage">Damage</SelectItem>
                              <SelectItem value="loss">Loss</SelectItem>
                              <SelectItem value="found">Found</SelectItem>
                              <SelectItem value="quality_issue">Quality Issue</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="adjustmentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adjustment Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="warehouseId"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Warehouse</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select warehouse" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {warehouses.map((warehouse) => (
                                <SelectItem key={warehouse.id} value={warehouse.id}>
                                  {warehouse.code} - {warehouse.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="locationId"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Location</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!selectedWarehouseId}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    selectedWarehouseId
                                      ? "Select location"
                                      : "Select warehouse first"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {locations.map((location) => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.code} {location.name ? `- ${location.name}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Reason</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter reason for adjustment" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Additional notes..."
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Line Items Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Line Items</h3>
                      <p className="text-sm text-muted-foreground">
                        Add items to adjust stock levels
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      size="sm"
                      disabled={!form.watch("warehouseId")}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Item
                    </Button>
                  </div>

                  {!form.watch("warehouseId") && (
                    <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-600">
                      Please select a warehouse before adding items
                    </div>
                  )}

                  {lineItems.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed py-12 text-center text-muted-foreground">
                      <p>No items added yet.</p>
                      <p className="text-sm">Click &quot;Add Item&quot; to get started.</p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead className="text-right">Current Qty</TableHead>
                              <TableHead className="text-right">Adjusted Qty</TableHead>
                              <TableHead className="text-right">Difference</TableHead>
                              <TableHead className="text-right">Unit Cost</TableHead>
                              <TableHead className="text-right">Total Value</TableHead>
                              <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => {
                              const difference = (item.adjustedQty || 0) - (item.currentQty || 0);
                              const totalValue = difference * (item.unitCost || 0);

                              return (
                                <TableRow key={index}>
                                  <TableCell>
                                    <div>
                                      <div className="font-medium">{item.itemName}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {item.itemCode}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.currentQty.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.adjustedQty.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span
                                      className={`font-medium ${
                                        difference > 0
                                          ? "text-green-600"
                                          : difference < 0
                                            ? "text-red-600"
                                            : "text-muted-foreground"
                                      }`}
                                    >
                                      {difference > 0 ? "+" : ""}
                                      {difference.toFixed(2)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(item.unitCost)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span
                                      className={`font-medium ${
                                        totalValue > 0
                                          ? "text-green-600"
                                          : totalValue < 0
                                            ? "text-red-600"
                                            : ""
                                      }`}
                                    >
                                      {formatCurrency(totalValue)}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditItem(index)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteItem(index)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Totals Section */}
                      <div className="rounded-lg bg-muted p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Calculator className="h-5 w-5" />
                          <h4 className="font-semibold">Summary</h4>
                        </div>
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total Adjustment Value:</span>
                          <span
                            className={
                              totals.totalValue > 0
                                ? "text-green-600"
                                : totals.totalValue < 0
                                  ? "text-red-600"
                                  : ""
                            }
                          >
                            {formatCurrency(totals.totalValue)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : selectedAdjustment
                        ? "Update Adjustment"
                        : "Create Adjustment"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Stock Adjustment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete adjustment{" "}
                <strong>{adjustmentToDelete?.adjustmentCode}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Post Dialog */}
        <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Post Stock Adjustment</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <p>
                    Are you sure you want to post adjustment{" "}
                    <strong>{adjustmentToPost?.adjustmentCode}</strong>?
                  </p>
                  <p className="mt-2">This will:</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    <li>Create a stock transaction</li>
                    <li>Update stock levels in the warehouse</li>
                    <li>Update the stock ledger</li>
                  </ul>
                  <p className="mt-2">This action cannot be undone.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmPost}
                className="bg-green-600 hover:bg-green-700"
                disabled={postMutation.isPending}
              >
                {postMutation.isPending ? "Posting..." : "Post Adjustment"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Line Item Dialog */}
      <StockAdjustmentLineItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSave={handleSaveItem}
        item={editingItem?.item || null}
        mode={editingItem ? "edit" : "add"}
        warehouseId={form.watch("warehouseId")}
        locationId={form.watch("locationId")}
        onItemSelect={handleFetchStockQty}
      />
    </>
  );
}
