"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Calculator, Check, ChevronsUpDown } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useCreateSalesOrder, useUpdateSalesOrder } from "@/hooks/useSalesOrders";
import { useCustomers } from "@/hooks/useCustomers";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import type { SalesOrder } from "@/types/sales-order";
import type { CreateSalesOrderRequest } from "@/types/sales-order";
import {
  QuotationLineItemDialog,
  type LineItemFormValues,
} from "../quotations/QuotationLineItemDialog";

const salesOrderFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDeliveryDate: z.string().min(1, "Expected delivery date is required"),
  shippingAddress: z.string().default(""),
  shippingCity: z.string().default(""),
  shippingState: z.string().default(""),
  shippingPostalCode: z.string().default(""),
  shippingCountry: z.string().default(""),
  paymentTerms: z.string().default(""),
  notes: z.string().default(""),
});

type SalesOrderFormInput = z.input<typeof salesOrderFormSchema>;

interface SalesOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrder?: SalesOrder | null;
}

export function SalesOrderFormDialog({
  open,
  onOpenChange,
  salesOrder,
}: SalesOrderFormDialogProps) {
  const t = useTranslations("salesOrderForm");
  const tCommon = useTranslations("common");
  const isEditMode = !!salesOrder;
  const { formatCurrency } = useCurrency();
  const createMutation = useCreateSalesOrder();
  const updateMutation = useUpdateSalesOrder();

  const { data: customersData } = useCustomers({ limit: 50 });
  const customers = customersData?.data || [];

  // Line items state
  const [lineItems, setLineItems] = useState<LineItemFormValues[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: LineItemFormValues;
  } | null>(null);

  // Customer combobox state
  const [customerOpen, setCustomerOpen] = useState(false);

  // Default values
  const defaultValues = useMemo<SalesOrderFormInput>(
    () => ({
      customerId: "",
      orderDate: new Date().toISOString().split("T")[0],
      expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      shippingAddress: "",
      shippingCity: "",
      shippingState: "",
      shippingPostalCode: "",
      shippingCountry: "",
      paymentTerms: "Payment due within 30 days",
      notes: "",
    }),
    []
  );

  const form = useForm<SalesOrderFormInput>({
    resolver: zodResolver(salesOrderFormSchema),
    defaultValues,
  });

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = lineItems.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
      0
    );
    const totalDiscount = lineItems.reduce((sum, item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
      return sum + (itemSubtotal * (item.discount || 0)) / 100;
    }, 0);
    const totalTax = lineItems.reduce((sum, item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
      const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
      const taxableAmount = itemSubtotal - itemDiscount;
      return sum + (taxableAmount * (item.taxRate || 0)) / 100;
    }, 0);
    const totalAmount = subtotal - totalDiscount + totalTax;

    return { subtotal, totalDiscount, totalTax, totalAmount };
  }, [lineItems]);

  // Reset form when dialog opens/closes or sales order changes
  useEffect(() => {
    if (open && salesOrder) {
      form.reset({
        customerId: salesOrder.customerId,
        orderDate: salesOrder.orderDate.split("T")[0],
        expectedDeliveryDate: salesOrder.expectedDeliveryDate.split("T")[0],
        shippingAddress: salesOrder.shippingAddress,
        shippingCity: salesOrder.shippingCity,
        shippingState: salesOrder.shippingState,
        shippingPostalCode: salesOrder.shippingPostalCode,
        shippingCountry: salesOrder.shippingCountry,
        paymentTerms: salesOrder.paymentTerms,
        notes: salesOrder.notes,
      });
      // Convert sales order line items to form format
      const formLineItems: LineItemFormValues[] = salesOrder.lineItems.map((item) => ({
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        uomId: item.uomId,
        discount: item.discount,
        taxRate: item.taxRate,
      }));
      setLineItems(formLineItems);
    } else if (open) {
      form.reset(defaultValues);
      setLineItems([]);
    }
  }, [open, salesOrder, form, defaultValues]);

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

  const handleSaveItem = (item: LineItemFormValues) => {
    if (editingItem !== null) {
      // Update existing item
      setLineItems((items) => items.map((it, i) => (i === editingItem.index ? item : it)));
    } else {
      // Add new item
      setLineItems((items) => [...items, item]);
    }
  };

  const onSubmit = async (data: SalesOrderFormInput) => {
    if (lineItems.length === 0) {
      alert(t("addLineItemRequired"));
      return;
    }

    try {
      const parsed = salesOrderFormSchema.parse(data);
      // Transform form data to API request format
      const apiRequest: CreateSalesOrderRequest = {
        customerId: parsed.customerId,
        orderDate: parsed.orderDate,
        expectedDeliveryDate: parsed.expectedDeliveryDate,
        lineItems: lineItems.map((item) => ({
          itemId: item.itemId,
          itemCode: item.itemCode || "",
          itemName: item.itemName || "",
          description: item.description,
          quantity: item.quantity,
          uomId: item.uomId, // Include unit of measure ID
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
        })),
        shippingAddress: parsed.shippingAddress,
        shippingCity: parsed.shippingCity,
        shippingState: parsed.shippingState,
        shippingPostalCode: parsed.shippingPostalCode,
        shippingCountry: parsed.shippingCountry,
        paymentTerms: parsed.paymentTerms,
        notes: parsed.notes,
      };

      if (isEditMode && salesOrder) {
        await updateMutation.mutateAsync({
          id: salesOrder.id,
          data: apiRequest,
        });
      } else {
        await createMutation.mutateAsync(apiRequest);
      }
      onOpenChange(false);
    } catch {}
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription>{isEditMode ? t("editDescription") : t("createDescription")}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="general">{t("generalTab")}</TabsTrigger>
                  <TabsTrigger value="items">{t("lineItemsTab", { count: String(lineItems.length) })}</TabsTrigger>
                  <TabsTrigger value="shipping">{t("shippingTab")}</TabsTrigger>
                  <TabsTrigger value="other">{t("termsTab")}</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => {
                      const selectedCustomer = customers.find((c) => c.id === field.value);
                      return (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t("customer")} *</FormLabel>
                          <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={customerOpen}
                                  className={cn(
                                    "w-full justify-between",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {selectedCustomer ? selectedCustomer.name : t("searchCustomer")}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder={t("customerSearchPlaceholder")} />
                                <CommandList className="max-h-[300px] overflow-y-auto">
                                  <CommandEmpty>{t("noCustomerFound")}</CommandEmpty>
                                  <CommandGroup>
                                    {customers
                                      .filter((c) => c.isActive)
                                      .map((customer) => (
                                        <CommandItem
                                          key={customer.id}
                                          value={`${customer.code} ${customer.name}`}
                                          onSelect={() => {
                                            field.onChange(customer.id);
                                            setCustomerOpen(false);
                                          }}
                                          className="flex items-start py-2"
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 mt-1 h-4 w-4 flex-shrink-0",
                                              field.value === customer.id
                                                ? "opacity-100"
                                                : "opacity-0"
                                            )}
                                          />
                                          <div className="min-w-0 flex-1">
                                            <div className="font-medium">{customer.name}</div>
                                            <div className="mt-0.5 text-xs text-muted-foreground">
                                              {customer.code}
                                            </div>
                                          </div>
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="orderDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("orderDate")} *</FormLabel>
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
                          <FormLabel>{t("expectedDelivery")} *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
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
                      <p className="text-sm text-muted-foreground">{t("lineItemsDescription")}</p>
                    </div>
                    <Button type="button" onClick={handleAddItem} size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      {t("addItem")}
                    </Button>
                  </div>

                  {lineItems.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed py-12 text-center text-muted-foreground">
                      <p>{t("noItems")}</p>
                      <p className="text-sm">{t("noItemsDescription")}</p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{tCommon("item")}</TableHead>
                              <TableHead className="text-right">{t("qty")}</TableHead>
                              <TableHead className="text-center">{t("unit")}</TableHead>
                              <TableHead className="text-right">{t("price")}</TableHead>
                              <TableHead className="text-right">{t("discountPct")}</TableHead>
                              <TableHead className="text-right">{t("taxPct")}</TableHead>
                              <TableHead className="text-right">{t("total")}</TableHead>
                              <TableHead className="w-[100px]">{tCommon("actions")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => {
                              const itemSubtotal = item.quantity * item.unitPrice;
                              const discountAmount = (itemSubtotal * item.discount) / 100;
                              const taxableAmount = itemSubtotal - discountAmount;
                              const taxAmount = (taxableAmount * item.taxRate) / 100;
                              const lineTotal = taxableAmount + taxAmount;

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
                                      {item.uomId || "—"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(item.unitPrice)}
                                  </TableCell>
                                  <TableCell className="text-right">{item.discount}%</TableCell>
                                  <TableCell className="text-right">{item.taxRate}%</TableCell>
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
                          <h4 className="font-semibold">{t("totals")}</h4>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>{t("subtotal")}:</span>
                            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>{t("discount")}:</span>
                            <span className="font-medium">
                              -{formatCurrency(totals.totalDiscount)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>{t("tax")}:</span>
                            <span className="font-medium">{formatCurrency(totals.totalTax)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-2 text-lg font-bold">
                            <span>{t("total")}:</span>
                            <span>{formatCurrency(totals.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="shipping" className="mt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="shippingAddress"
                    render={({ field }) => (
                      <FormItem>
                          <FormLabel>{t("address")}</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder={t("addressPlaceholder")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="shippingCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("city")}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={t("cityPlaceholder")} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="shippingState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("stateProvince")}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={t("statePlaceholder")} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="shippingPostalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("postalCode")}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={t("postalCodePlaceholder")} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="shippingCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("country")}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={t("countryPlaceholder")} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="other" className="mt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("paymentTerms")}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("internalNotes")}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={4} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? t("saving")
                    : isEditMode
                      ? t("updateOrder")
                      : t("createOrder")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Line Item Dialog */}
      <QuotationLineItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSave={handleSaveItem}
        item={editingItem?.item || null}
        mode={editingItem ? "edit" : "add"}
      />
    </>
  );
}
