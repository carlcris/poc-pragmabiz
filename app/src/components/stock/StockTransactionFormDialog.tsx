"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateStockTransaction } from "@/hooks/useStockTransactions";
import { useItems } from "@/hooks/useItems";
import { useWarehouses } from "@/hooks/useWarehouses";
import { stockTransactionFormSchema, type StockTransactionFormValues } from "@/lib/validations/stock-transaction";
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

interface StockTransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TRANSACTION_TYPES = [
  { value: "in", label: "Stock In" },
  { value: "out", label: "Stock Out" },
  { value: "transfer", label: "Transfer" },
  { value: "adjustment", label: "Adjustment" },
] as const;

const REASONS = {
  in: [
    "Purchase receipt",
    "Production output",
    "Customer return",
    "Other",
  ],
  out: [
    "Sales order",
    "Production consumption",
    "Damage/Loss",
    "Other",
  ],
  transfer: [
    "Stock rebalancing",
    "Customer request",
    "Warehouse consolidation",
    "Other",
  ],
  adjustment: [
    "Physical count adjustment",
    "Damaged goods",
    "System correction",
    "Other",
  ],
};

export function StockTransactionFormDialog({ open, onOpenChange }: StockTransactionFormDialogProps) {
  const createTransaction = useCreateStockTransaction();

  const { data: itemsData } = useItems({ limit: 1000 });
  const { data: warehousesData } = useWarehouses({ limit: 1000 });

  const items = itemsData?.data || [];
  const warehouses = warehousesData?.data?.filter(wh => wh.isActive) || [];

  const form = useForm<StockTransactionFormValues>({
    resolver: zodResolver(stockTransactionFormSchema),
    defaultValues: {
      transactionDate: new Date().toISOString().slice(0, 16),
      transactionType: "in",
      itemId: "",
      warehouseId: "",
      toWarehouseId: "",
      quantity: 1,
      referenceType: "",
      referenceId: "",
      referenceNumber: "",
      reason: "",
      notes: "",
    },
  });

  const transactionType = form.watch("transactionType");
  const selectedItemId = form.watch("itemId");

  useEffect(() => {
    // Reset destination warehouse when transaction type changes
    if (transactionType !== "transfer") {
      form.setValue("toWarehouseId", "");
    }
  }, [transactionType, form]);

  const onSubmit = async (values: StockTransactionFormValues) => {
    try {
      // Find the selected item to get its UOM
      const selectedItem = items.find((item) => item.id === values.itemId);
      if (!selectedItem || !selectedItem.uomId) {
        toast.error("Invalid item selected or item has no unit of measure");
        return;
      }

      // Transform form data to API request format
      const requestData = {
        transactionDate: values.transactionDate,
        transactionType: values.transactionType,
        warehouseId: values.warehouseId,
        toWarehouseId: values.toWarehouseId || undefined,
        referenceType: values.referenceType || undefined,
        referenceId: values.referenceId || undefined,
        referenceNumber: values.referenceNumber || undefined,
        notes: values.reason, // Use reason as transaction notes
        items: [
          {
            itemId: values.itemId,
            quantity: values.quantity,
            uomId: selectedItem.uomId,
            notes: values.notes || undefined,
          },
        ],
      };

      await createTransaction.mutateAsync(requestData);
      toast.success("Stock transaction created successfully");
      onOpenChange(false);
      form.reset();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create stock transaction";
      toast.error(errorMessage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Stock Transaction</DialogTitle>
          <DialogDescription>
            Record a new inventory movement or adjustment
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="transactionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Date *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="transactionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TRANSACTION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.code} - {item.name}
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
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {transactionType === "transfer" ? "From Warehouse *" : "Warehouse *"}
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
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

              {transactionType === "transfer" && (
                <FormField
                  control={form.control}
                  name="toWarehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Warehouse *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination" />
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
              )}
            </div>

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="referenceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference Number</FormLabel>
                  <FormControl>
                    <Input placeholder="PO-2024-001, SO-2024-001, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REASONS[transactionType]?.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input placeholder="Additional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                disabled={createTransaction.isPending}
              >
                {createTransaction.isPending ? "Creating..." : "Create Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
