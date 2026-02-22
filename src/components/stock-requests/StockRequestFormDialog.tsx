"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import type { StockRequest } from "@/types/stock-request";
import type { StockRequestLineItemPayload } from "@/components/stock-requests/StockRequestLineItemDialog";
import { StockRequestLineItemDialog } from "@/components/stock-requests/StockRequestLineItemDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const requestFormSchema = z
  .object({
    request_date: z.string().min(1, "Request date is required"),
    required_date: z.string().min(1, "Required date is required"),
    requesting_warehouse_id: z.string().min(1, "Requested by is required"),
    fulfilling_warehouse_id: z.string().min(1, "Requested to is required"),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    purpose: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.fulfilling_warehouse_id && values.fulfilling_warehouse_id === values.requesting_warehouse_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Requested to must be different from requested by",
        path: ["fulfilling_warehouse_id"],
      });
    }
  });

export type StockRequestFormValues = z.infer<typeof requestFormSchema>;

type WarehouseOption = {
  id: string;
  code: string;
  name: string;
};

type StockRequestFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRequest: StockRequest | null;
  warehouses: WarehouseOption[];
  defaultRequestingWarehouseId: string;
  isSaving: boolean;
  onSave: (payload: {
    values: StockRequestFormValues;
    lineItems: StockRequestLineItemPayload[];
    selectedRequest: StockRequest | null;
  }) => Promise<void>;
};

export function StockRequestFormDialog({
  open,
  onOpenChange,
  selectedRequest,
  warehouses,
  defaultRequestingWarehouseId,
  isSaving,
  onSave,
}: StockRequestFormDialogProps) {
  const [lineItems, setLineItems] = useState<StockRequestLineItemPayload[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: StockRequestLineItemPayload;
  } | null>(null);

  const form = useForm<StockRequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      request_date: new Date().toISOString().split("T")[0],
      required_date: new Date().toISOString().split("T")[0],
      requesting_warehouse_id: "",
      fulfilling_warehouse_id: "",
      priority: "normal",
      purpose: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open && selectedRequest) {
      form.reset({
        request_date: selectedRequest.request_date,
        required_date: selectedRequest.required_date,
        requesting_warehouse_id: selectedRequest.requesting_warehouse_id,
        fulfilling_warehouse_id: selectedRequest.fulfilling_warehouse_id || "",
        priority: selectedRequest.priority,
        purpose: selectedRequest.purpose || "",
        notes: selectedRequest.notes || "",
      });

      const formLineItems: StockRequestLineItemPayload[] =
        selectedRequest.stock_request_items?.map((item) => ({
          itemId: item.item_id,
          itemCode: item.items?.item_code || "",
          itemName: item.items?.item_name || "",
          uomId: item.uom_id,
          uomLabel: item.units_of_measure?.code || item.units_of_measure?.symbol || "",
          requestedQty: item.requested_qty,
          notes: item.notes || "",
        })) || [];
      setLineItems(formLineItems);
    } else if (open) {
      form.reset({
        request_date: new Date().toISOString().split("T")[0],
        required_date: new Date().toISOString().split("T")[0],
        requesting_warehouse_id: defaultRequestingWarehouseId,
        fulfilling_warehouse_id: "",
        priority: "normal",
        purpose: "",
        notes: "",
      });
      setLineItems([]);
    }
  }, [defaultRequestingWarehouseId, form, open, selectedRequest]);

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

  const handleSaveItem = (item: StockRequestLineItemPayload) => {
    if (editingItem !== null) {
      setLineItems((items) => items.map((it, i) => (i === editingItem.index ? item : it)));
    } else {
      setLineItems((items) => [...items, item]);
    }
  };

  const onSubmit = async (values: StockRequestFormValues) => {
    if (lineItems.length === 0) {
      alert("Please add at least one line item");
      return;
    }

    try {
      await onSave({ values, lineItems, selectedRequest });
      onOpenChange(false);
      setLineItems([]);
      form.reset();
    } catch {
      // Error handled by parent mutations
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{selectedRequest ? "Edit Stock Request" : "Create Stock Request"}</DialogTitle>
            <DialogDescription>
              {selectedRequest
                ? `Edit request ${selectedRequest.request_code}`
                : "Create a new stock request"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-1">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="request_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Request Date<span className="ml-0.5 text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="required_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Required Date<span className="ml-0.5 text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Priority<span className="ml-0.5 text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="col-span-3 grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="requesting_warehouse_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Requested By<span className="ml-0.5 text-destructive">*</span></FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select requested by" />
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
                        name="fulfilling_warehouse_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Requested To<span className="ml-0.5 text-destructive">*</span></FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select requested to" />
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
                    </div>

                    <FormField
                      control={form.control}
                      name="purpose"
                      render={({ field }) => (
                        <FormItem className="col-span-3">
                          <FormLabel className="text-xs">Purpose</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter purpose of request (optional)" {...field} className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="col-span-3">
                          <FormLabel className="text-xs">Notes</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Additional notes (optional)" className="h-16 resize-none" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium">Line Items</h3>
                        <p className="text-xs text-muted-foreground">Add items to request</p>
                      </div>
                      <Button type="button" onClick={handleAddItem} size="sm" className="h-8">
                        <Plus className="mr-1 h-3 w-3" />
                        Add Item
                      </Button>
                    </div>

                    {lineItems.length === 0 ? (
                      <div className="rounded-lg border-2 border-dashed py-8 text-center text-muted-foreground">
                        <p className="text-sm">No items added yet.</p>
                        <p className="text-xs">Click &quot;Add Item&quot; to get started.</p>
                      </div>
                    ) : (
                      <div className="max-h-[300px] overflow-y-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="py-2 text-xs">Item</TableHead>
                              <TableHead className="py-2 text-right text-xs">Qty</TableHead>
                              <TableHead className="py-2 text-xs">Unit</TableHead>
                              <TableHead className="py-2 text-xs">Notes</TableHead>
                              <TableHead className="w-[80px] py-2 text-xs">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell className="py-2">
                                  <div>
                                    <div className="text-sm font-medium">{item.itemName}</div>
                                    <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 text-right text-sm">{item.requestedQty.toFixed(2)}</TableCell>
                                <TableCell className="py-2 text-sm">{item.uomLabel || "--"}</TableCell>
                                <TableCell className="py-2">
                                  <div className="max-w-[150px] truncate text-sm">{item.notes || "--"}</div>
                                </TableCell>
                                <TableCell className="py-2">
                                  <div className="flex items-center gap-1">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => handleEditItem(index)} className="h-7 w-7 p-0">
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteItem(index)} className="h-7 w-7 p-0">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-4 flex-shrink-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-9">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !form.formState.isValid || lineItems.length === 0}
                  className="h-9"
                >
                  {isSaving ? "Saving..." : selectedRequest ? "Update Request" : "Create Request"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {itemDialogOpen && (
        <StockRequestLineItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          onSave={handleSaveItem}
          item={editingItem?.item || null}
          mode={editingItem ? "edit" : "add"}
        />
      )}
    </>
  );
}
