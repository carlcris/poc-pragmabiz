"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { useCreatePurchaseOrder, useUpdatePurchaseOrder } from "@/hooks/usePurchaseOrders";
import { useSuppliers } from "@/hooks/useSuppliers";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/hooks/useCurrency";
import type { PurchaseOrder } from "@/types/purchase-order";
import {
  createPurchaseOrderFormSchema,
  type PurchaseOrderFormValues,
} from "@/lib/validations/purchase-order-dialog";
import {
  PurchaseOrderLineItemDialog,
  type PurchaseOrderLineItemFormValues,
} from "./PurchaseOrderLineItemDialog";

interface PurchaseOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder?: PurchaseOrder | null;
  initialLineItems?: PurchaseOrderLineItemFormValues[];
  initialActiveTab?: "general" | "items" | "terms";
}

export function PurchaseOrderFormDialog({
  open,
  onOpenChange,
  purchaseOrder,
  initialLineItems,
  initialActiveTab,
}: PurchaseOrderFormDialogProps) {
  const t = useTranslations("purchaseOrderForm");
  const tValidation = useTranslations("purchaseOrderValidation");
  const isEditMode = !!purchaseOrder;
  const { formatCurrency } = useCurrency();
  const createMutation = useCreatePurchaseOrder();
  const updateMutation = useUpdatePurchaseOrder();
  const purchaseOrderFormSchema = createPurchaseOrderFormSchema((key) => tValidation(key));

  const { data: suppliersData } = useSuppliers({ limit: 50 });
  const suppliers = suppliersData?.data || [];

  // Line items state
  const [lineItems, setLineItems] = useState<PurchaseOrderLineItemFormValues[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: PurchaseOrderLineItemFormValues;
  } | null>(null);
  const [activeTab, setActiveTab] = useState("general");

  // Default values
  const defaultValues = useMemo<PurchaseOrderFormValues>(
    () => ({
      supplierId: "",
      orderDate: new Date().toISOString().split("T")[0],
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      deliveryAddress: "",
      deliveryCity: "",
      deliveryState: "",
      deliveryCountry: "Philippines",
      deliveryPostalCode: "",
      notes: "",
    }),
    []
  );

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues,
  });

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => {
      const lineTotal = item.lineTotal ?? (item.quantity || 0) * (item.rate || 0);
      const discountRate = (item.discountPercent || 0) / 100;
      const taxRate = (item.taxPercent || 0) / 100;
      const denominator = (1 - discountRate) * (1 + taxRate);
      const itemSubtotal = denominator > 0 ? lineTotal / denominator : 0;
      return sum + itemSubtotal;
    }, 0);
    const totalDiscount = lineItems.reduce((sum, item) => {
      const lineTotal = item.lineTotal ?? (item.quantity || 0) * (item.rate || 0);
      const discountRate = (item.discountPercent || 0) / 100;
      const taxRate = (item.taxPercent || 0) / 100;
      const denominator = (1 - discountRate) * (1 + taxRate);
      const itemSubtotal = denominator > 0 ? lineTotal / denominator : 0;
      return sum + itemSubtotal * discountRate;
    }, 0);
    const totalTax = lineItems.reduce((sum, item) => {
      const lineTotal = item.lineTotal ?? (item.quantity || 0) * (item.rate || 0);
      const discountRate = (item.discountPercent || 0) / 100;
      const taxRate = (item.taxPercent || 0) / 100;
      const denominator = (1 - discountRate) * (1 + taxRate);
      const itemSubtotal = denominator > 0 ? lineTotal / denominator : 0;
      const taxableAmount = itemSubtotal * (1 - discountRate);
      return sum + taxableAmount * taxRate;
    }, 0);
    const totalAmount = subtotal - totalDiscount + totalTax;

    return { subtotal, totalDiscount, totalTax, totalAmount };
  }, [lineItems]);

  // Reset form when dialog opens/closes or purchase order changes
  useEffect(() => {
    if (open && purchaseOrder) {
      form.reset({
        supplierId: purchaseOrder.supplierId,
        orderDate: purchaseOrder.orderDate.split("T")[0],
        expectedDeliveryDate: purchaseOrder.expectedDeliveryDate.split("T")[0],
        deliveryAddress: purchaseOrder.deliveryAddress || "",
        deliveryCity: purchaseOrder.deliveryCity || "",
        deliveryState: purchaseOrder.deliveryState || "",
        deliveryCountry: purchaseOrder.deliveryCountry || "Philippines",
        deliveryPostalCode: purchaseOrder.deliveryPostalCode || "",
        notes: purchaseOrder.notes || "",
      });
      // Convert PO line items to form format
      const formLineItems: PurchaseOrderLineItemFormValues[] =
        purchaseOrder.items?.map((item) => ({
          itemId: item.itemId,
          itemCode: item.item?.code,
          itemName: item.item?.name,
          quantity: item.quantity,
          rate: item.rate,
          uomId: item.uomId || "",
          discountPercent: item.discountPercent,
          taxPercent: item.taxPercent,
          lineTotal: item.lineTotal,
        })) || [];
      setLineItems(formLineItems);
      setActiveTab("general");
    } else if (open) {
      form.reset(defaultValues);
      setLineItems(initialLineItems || []);
      setActiveTab(initialActiveTab || "general");
    }
  }, [open, purchaseOrder, form, defaultValues, initialLineItems, initialActiveTab]);

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

  const handleSaveItem = (item: PurchaseOrderLineItemFormValues) => {
    if (editingItem !== null) {
      // Update existing item
      setLineItems((items) => items.map((it, i) => (i === editingItem.index ? item : it)));
    } else {
      // Add new item
      setLineItems((items) => [...items, item]);
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (supplier) {
      // Auto-fill delivery address from supplier's billing address
      form.setValue("deliveryAddress", supplier.billingAddress);
      form.setValue("deliveryCity", supplier.billingCity);
      form.setValue("deliveryState", supplier.billingState);
      form.setValue("deliveryPostalCode", supplier.billingPostalCode);
      form.setValue("deliveryCountry", supplier.billingCountry);
    }
  };

  const onSubmit = async (data: PurchaseOrderFormValues) => {
    if (lineItems.length === 0) {
      toast.error(t("lineItemsRequired"));
      return;
    }

    try {
      // Transform form data to API request format
      const apiRequest = {
        supplierId: data.supplierId,
        orderDate: data.orderDate,
        expectedDeliveryDate: data.expectedDeliveryDate,
        deliveryAddress: data.deliveryAddress,
        deliveryCity: data.deliveryCity,
        deliveryState: data.deliveryState,
        deliveryCountry: data.deliveryCountry,
        deliveryPostalCode: data.deliveryPostalCode,
        items: lineItems.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          uomId: item.uomId,
          rate: item.rate,
          discountPercent: item.discountPercent || 0,
          taxPercent: item.taxPercent || 0,
        })),
        notes: data.notes || "",
        discountAmount: totals.totalDiscount,
        taxAmount: totals.totalTax,
      };

      if (isEditMode && purchaseOrder) {
        await updateMutation.mutateAsync({
          id: purchaseOrder.id,
          data: apiRequest,
        });
        toast.success(t("updateSuccess"));
      } else {
        await createMutation.mutateAsync(apiRequest);
        toast.success(t("createSuccess"));
      }
      onOpenChange(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : isEditMode
            ? t("updateError")
            : t("createError");
      toast.error(errorMessage);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? t("editDescription")
                : t("createDescription")}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit, (errors) => {
                // Switch to general tab if there are validation errors there
                if (Object.keys(errors).length > 0) {
                  setActiveTab("general");
                  toast.error(t("generalTabError"));
                }
              })}
              className="space-y-6"
            >
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">{t("generalTab")}</TabsTrigger>
                  <TabsTrigger value="items">{t("itemsTab", { count: lineItems.length })}</TabsTrigger>
                  <TabsTrigger value="terms">{t("notesTab")}</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("supplierLabel")}</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleSupplierChange(value);
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("selectSupplier")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {suppliers
                              .filter((s) => s.status === "active")
                              .map((supplier) => (
                                <SelectItem key={supplier.id} value={supplier.id}>
                                  {supplier.code} - {supplier.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="orderDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("orderDateLabel")}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expectedDeliveryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("expectedDeliveryDateLabel")}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">{t("deliveryAddressTitle")}</h4>
                    <FormField
                      control={form.control}
                      name="deliveryAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("streetAddressLabel")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("streetAddressPlaceholder")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="deliveryCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("cityLabel")}</FormLabel>
                            <FormControl>
                              <Input placeholder={t("cityPlaceholder")} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deliveryState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("stateLabel")}</FormLabel>
                            <FormControl>
                              <Input placeholder={t("statePlaceholder")} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deliveryPostalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("postalCodeLabel")}</FormLabel>
                            <FormControl>
                              <Input placeholder={t("postalCodePlaceholder")} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="deliveryCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("countryLabel")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("countryPlaceholder")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="items" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">{t("lineItemsTitle")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("lineItemsDescription")}
                      </p>
                    </div>
                    <Button type="button" onClick={handleAddItem} size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      {t("addItem")}
                    </Button>
                  </div>

                  {lineItems.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed py-12 text-center text-muted-foreground">
                      <p>{t("noItemsTitle")}</p>
                      <p className="text-sm">{t("noItemsDescription")}</p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("item")}</TableHead>
                              <TableHead className="text-right">{t("qty")}</TableHead>
                              <TableHead className="text-center">{t("unit")}</TableHead>
                              <TableHead className="text-right">{t("rate")}</TableHead>
                              <TableHead className="text-right">{t("discount")}</TableHead>
                              <TableHead className="text-right">{t("tax")}</TableHead>
                              <TableHead className="text-right">{t("total")}</TableHead>
                              <TableHead className="w-[100px]">{t("actions")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => {
                              const lineTotal = item.lineTotal ?? item.quantity * item.rate;

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
                                  <TableCell className="text-right">{item.quantity}</TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-muted-foreground">
                                      {item.uomId || t("noUnit")}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(item.rate)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.discountPercent}%
                                  </TableCell>
                                  <TableCell className="text-right">{item.taxPercent}%</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(lineTotal)}
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
                          <h4 className="font-semibold">{t("totalsTitle")}</h4>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>{t("subtotal")}</span>
                            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>{t("discountAmount")}</span>
                            <span className="font-medium">
                              -{formatCurrency(totals.totalDiscount)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t("taxAmount")}</span>
                            <span className="font-medium">{formatCurrency(totals.totalTax)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2 text-lg font-bold">
                            <span>{t("totalAmount")}</span>
                            <span>{formatCurrency(totals.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="terms" className="mt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("internalNotes")}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={6} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? t("saving")
                    : isEditMode
                      ? t("updateAction")
                      : t("createAction")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Line Item Dialog */}
      <PurchaseOrderLineItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSave={handleSaveItem}
        item={editingItem?.item || null}
        mode={editingItem ? "edit" : "add"}
      />
    </>
  );
}
