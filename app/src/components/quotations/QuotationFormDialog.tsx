"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Calculator } from "lucide-react";
import { z } from "zod";
import { useCreateQuotation, useUpdateQuotation } from "@/hooks/useQuotations";
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
import type { Quotation } from "@/types/quotation";
import type { CreateQuotationRequest } from "@/types/quotation";
import { QuotationLineItemDialog, type LineItemFormValues } from "./QuotationLineItemDialog";

const quotationFormSchema = z.object({
  companyId: z.string().optional(),
  customerId: z.string().min(1, "Customer is required"),
  quotationDate: z.string().min(1, "Quotation date is required"),
  validUntil: z.string().min(1, "Valid until date is required"),
  terms: z.string(),
  notes: z.string(),
});

type QuotationFormValues = z.infer<typeof quotationFormSchema>;

interface QuotationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation?: Quotation | null;
}

export function QuotationFormDialog({
  open,
  onOpenChange,
  quotation,
}: QuotationFormDialogProps) {
  const isEditMode = !!quotation;
  const { formatCurrency } = useCurrency();
  const createMutation = useCreateQuotation();
  const updateMutation = useUpdateQuotation();

  const { data: customersData } = useCustomers({ limit: 1000 });
  const customers = customersData?.data || [];

  // Line items state
  const [lineItems, setLineItems] = useState<LineItemFormValues[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: LineItemFormValues;
  } | null>(null);

  // Default values
  const defaultValues: QuotationFormValues = {
    companyId: "",
    customerId: "",
    quotationDate: new Date().toISOString().split("T")[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    terms:
      "Payment due within 30 days. Delivery within 2 weeks of order confirmation.",
    notes: "",
  };

  const form = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationFormSchema),
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

  // Reset form when dialog opens/closes or quotation changes
  useEffect(() => {
    if (open && quotation) {
      form.reset({
        companyId: quotation.companyId,
        customerId: quotation.customerId,
        quotationDate: quotation.quotationDate.split("T")[0],
        validUntil: quotation.validUntil.split("T")[0],
        terms: quotation.terms,
        notes: quotation.notes,
      });
      // Convert quotation line items to form format
      const formLineItems: LineItemFormValues[] = quotation.lineItems.map(
        (item) => ({
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          uomId: item.uomId,
          discount: item.discount,
          taxRate: item.taxRate,
        })
      );
      setLineItems(formLineItems);
    } else if (open) {
      form.reset(defaultValues);
      setLineItems([]);
    }
  }, [open, quotation, form]);

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
      setLineItems((items) =>
        items.map((it, i) => (i === editingItem.index ? item : it))
      );
    } else {
      // Add new item
      setLineItems((items) => [...items, item]);
    }
  };

  const onSubmit = async (data: QuotationFormValues) => {
    if (lineItems.length === 0) {
      alert("Please add at least one line item");
      return;
    }

    try {
      // Transform form data to API request format
      const apiRequest: CreateQuotationRequest = {
        quotationCode: "", // Will be auto-generated by API
        customerId: data.customerId,
        quotationDate: data.quotationDate,
        validUntil: data.validUntil,
        items: lineItems.map((item, index) => ({
          itemId: item.itemId,
          description: item.description,
          quantity: item.quantity,
          uomId: item.uomId, // Should always be set from the item
          rate: item.unitPrice, // Transform unitPrice -> rate
          discountPercent: item.discount, // Transform discount -> discountPercent
          taxPercent: item.taxRate, // Transform taxRate -> taxPercent
          sortOrder: index,
        })),
        termsConditions: data.terms,
        notes: data.notes,
      };

      if (isEditMode && quotation) {
        await updateMutation.mutateAsync({
          id: quotation.id,
          data: {
            quotationDate: apiRequest.quotationDate,
            validUntil: apiRequest.validUntil,
            items: apiRequest.items,
            termsConditions: apiRequest.termsConditions,
            notes: apiRequest.notes,
          },
        });
      } else {
        await createMutation.mutateAsync(apiRequest);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving quotation:", error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Quotation" : "Create New Quotation"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update quotation details and line items."
                : "Fill in the quotation details and add line items."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="items">
                    Line Items ({lineItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="terms">Terms & Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers
                              .filter((c: any) => c.isActive)
                              .map((customer: any) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.code} - {customer.name}
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
                      name="quotationDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quotation Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="validUntil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valid Until *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="items" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Line Items</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage products or services in this quotation
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  {lineItems.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                      <p>No items added yet.</p>
                      <p className="text-sm">Click "Add Item" to get started.</p>
                    </div>
                  ) : (
                    <>
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">
                                Price
                              </TableHead>
                              <TableHead className="text-right">
                                Disc %
                              </TableHead>
                              <TableHead className="text-right">
                                Tax %
                              </TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => {
                              const itemSubtotal =
                                item.quantity * item.unitPrice;
                              const discountAmount =
                                (itemSubtotal * item.discount) / 100;
                              const taxableAmount =
                                itemSubtotal - discountAmount;
                              const taxAmount =
                                (taxableAmount * item.taxRate) / 100;
                              const lineTotal = taxableAmount + taxAmount;

                              return (
                                <TableRow key={index}>
                                  <TableCell>
                                    <div>
                                      <div className="font-medium">
                                        {item.itemName}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {item.itemCode}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.quantity}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(item.unitPrice)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.discount}%
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {item.taxRate}%
                                  </TableCell>
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
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <Calculator className="h-5 w-5" />
                          <h4 className="font-semibold">Totals</h4>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="font-medium">
                              {formatCurrency(totals.subtotal)}
                            </span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>Discount:</span>
                            <span className="font-medium">
                              -{formatCurrency(totals.totalDiscount)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tax:</span>
                            <span className="font-medium">
                              {formatCurrency(totals.totalTax)}
                            </span>
                          </div>
                          <div className="flex justify-between text-lg font-bold border-t pt-2">
                            <span>Total:</span>
                            <span>{formatCurrency(totals.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="terms" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Terms & Conditions</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={4} />
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
                        <FormLabel>Internal Notes</FormLabel>
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : isEditMode
                    ? "Update Quotation"
                    : "Create Quotation"}
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
