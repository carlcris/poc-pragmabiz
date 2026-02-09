"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown, Plus, Trash2, FileText, Package, ShoppingCart } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import {
  useCreateStockRequisition,
  useUpdateStockRequisition,
} from "@/hooks/useStockRequisitions";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useItems } from "@/hooks/useItems";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import type { StockRequisition } from "@/types/stock-requisition";

const srFormSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  requisitionDate: z.string().min(1, "Requisition date is required"),
  requiredByDate: z.string().optional(),
  notes: z.string().optional(),
});

type SRFormValues = z.infer<typeof srFormSchema>;

type LineItem = {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  requestedQty: number;
  unitPrice: number;
  notes?: string;
};

type StockRequisitionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockRequisition?: StockRequisition | null;
};

export function StockRequisitionFormDialog({
  open,
  onOpenChange,
  stockRequisition,
}: StockRequisitionFormDialogProps) {
  const isEditMode = !!stockRequisition;
  const { formatCurrency } = useCurrency();
  const createMutation = useCreateStockRequisition();
  const updateMutation = useUpdateStockRequisition();

  const { data: suppliersData } = useSuppliers({ limit: 1000 });
  const suppliers = suppliersData?.data || [];

  const { data: itemsData } = useItems({ limit: 1000 });
  const items = useMemo(() => itemsData?.data || [], [itemsData?.data]);

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [itemOpen, setItemOpen] = useState(false);
  const [addItemError, setAddItemError] = useState("");
  const [activeTab, setActiveTab] = useState("general");

  // Default values
  const defaultValues = useMemo<SRFormValues>(
    () => ({
      supplierId: "",
      requisitionDate: new Date().toISOString().split("T")[0],
      requiredByDate: "",
      notes: "",
    }),
    []
  );

  const form = useForm<SRFormValues>({
    resolver: zodResolver(srFormSchema),
    defaultValues,
  });

  // Calculate total
  const totalAmount = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.requestedQty * item.unitPrice, 0);
  }, [lineItems]);

  useEffect(() => {
    if (!selectedItemId) return;
    const selectedItem = items.find((item) => item.id === selectedItemId);
    if (!selectedItem) return;
    const cost =
      selectedItem.purchasePrice ??
      selectedItem.standardCost ??
      selectedItem.listPrice ??
      0;
    setPrice(Number(cost).toFixed(2));
  }, [items, selectedItemId]);

  // Reset form when dialog opens/closes or SR changes
  useEffect(() => {
    if (open && stockRequisition) {
      form.reset({
        supplierId: stockRequisition.supplierId,
        requisitionDate: stockRequisition.requisitionDate.split("T")[0],
        requiredByDate: stockRequisition.requiredByDate?.split("T")[0] || "",
        notes: stockRequisition.notes || "",
      });
      // Convert SR line items to form format
      const formLineItems: LineItem[] =
        stockRequisition.items?.map((item) => ({
          itemId: item.itemId,
          itemCode: item.item?.code,
          itemName: item.item?.name,
          requestedQty: item.requestedQty,
          unitPrice: item.unitPrice,
          notes: item.notes,
        })) || [];
      setLineItems(formLineItems);
    } else if (open) {
      form.reset(defaultValues);
      setLineItems([]);
      setSelectedItemId("");
      setQuantity("");
      setPrice("");
      setAddItemError("");
      setActiveTab("general");
    }
  }, [open, stockRequisition, form, defaultValues]);

  const handleAddItem = () => {
    // Clear any previous errors
    setAddItemError("");

    // Validation
    if (!selectedItemId || !quantity || !price) {
      setAddItemError("Please select an item and enter quantity and price");
      return;
    }

    const selectedItem = items.find((i) => i.id === selectedItemId);
    if (!selectedItem) {
      setAddItemError("Item not found");
      return;
    }

    const newItem: LineItem = {
      itemId: selectedItemId,
      itemCode: selectedItem.code,
      itemName: selectedItem.name,
      requestedQty: parseFloat(quantity),
      unitPrice: parseFloat(price),
    };

    setLineItems([...lineItems, newItem]);
    setSelectedItemId("");
    setQuantity("");
    setPrice("");
    toast.success("Item added successfully");
  };

  const handleRemoveItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  async function onSubmit(values: SRFormValues) {
    if (lineItems.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }

    try {
      const requestData = {
        supplierId: values.supplierId,
        requisitionDate: values.requisitionDate,
        requiredByDate: values.requiredByDate,
        notes: values.notes,
        items: lineItems.map((item) => ({
          itemId: item.itemId,
          requestedQty: item.requestedQty,
          unitPrice: item.unitPrice,
          notes: item.notes,
        })),
      };

      if (isEditMode) {
        await updateMutation.mutateAsync({
          id: stockRequisition.id,
          data: requestData,
        });
        toast.success("Stock Requisition updated successfully");
      } else {
        await createMutation.mutateAsync(requestData);
        toast.success("Stock Requisition created successfully");
      }

      onOpenChange(false);
      form.reset();
      setLineItems([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save stock requisition"
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-gray-200 bg-white flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <DialogTitle className="text-2xl font-bold text-gray-900 mb-1">
                  {isEditMode ? "Edit Stock Requisition" : "New Stock Requisition"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    {isEditMode
                      ? "Update requisition details and modify line items"
                      : "Create a new requisition by filling in supplier details and adding items"}
                  </DialogDescription>
                </div>
              </div>
            </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-1 flex-col min-h-0">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex flex-1 flex-col min-h-0"
            >
              <div className="px-6 pt-4 flex-shrink-0">
                <TabsList className="grid w-full grid-cols-2 h-9">
                  <TabsTrigger value="general" className="gap-1.5 text-xs font-semibold">
                    <FileText className="h-3.5 w-3.5" />
                    General
                  </TabsTrigger>
                  <TabsTrigger value="items" className="gap-1.5 text-xs font-semibold">
                    <Package className="h-3.5 w-3.5" />
                    Items {lineItems.length > 0 && (
                      <span className="ml-1 rounded-full bg-purple-600 px-1.5 py-0.5 text-[10px] text-white">
                        {lineItems.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="general" className="flex-1 min-h-0 overflow-y-auto px-6 py-5 bg-gray-50">
                <div className="max-w-5xl mx-auto space-y-5">
                  {/* Basic Information Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-transparent">
                          <FileText className="h-4 w-4 text-gray-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">Basic Information</h3>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <FormField
                          control={form.control}
                          name="supplierId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold text-gray-700 tracking-wide">Supplier *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-10 text-sm border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                                    <SelectValue placeholder="Select supplier" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {suppliers.map((supplier) => (
                                    <SelectItem key={supplier.id} value={supplier.id}>
                                      {supplier.name} ({supplier.code})
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
                          name="requisitionDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold text-gray-700 tracking-wide">Requisition Date *</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} className="h-10 text-sm border-gray-300 focus:border-purple-500 focus:ring-purple-500" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="requiredByDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold text-gray-700 tracking-wide">Required By Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} className="h-10 text-sm border-gray-300 focus:border-purple-500 focus:ring-purple-500" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-gray-700 tracking-wide">Notes</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={2} placeholder="Add any additional notes or comments..." className="resize-none text-sm border-gray-300 focus:border-purple-500 focus:ring-purple-500" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="items" className="flex-1 min-h-0 overflow-y-auto px-6 py-5 bg-gray-50">
                <div className="max-w-5xl mx-auto space-y-5">
                  {/* Add Items Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3.5 bg-gradient-to-r from-purple-50 to-violet-50 border-b border-purple-100">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-transparent">
                          <Package className="h-4 w-4 text-gray-600" />
                        </div>
                      <h3 className="text-sm font-semibold text-gray-900">Add Items to Stock Requisition</h3>
                      </div>
                    </div>
                    <div className="p-5 bg-gradient-to-br from-purple-50/30 to-violet-50/30">
                      <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-5">
                        <label className="block text-xs font-semibold text-gray-700 tracking-wide mb-2">Item *</label>
                        <Popover open={itemOpen} onOpenChange={setItemOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={itemOpen}
                              className={cn(
                                "w-full justify-between h-10 text-sm bg-white border-gray-300 hover:border-purple-400",
                                !selectedItemId && "text-muted-foreground"
                              )}
                            >
                              {selectedItemId
                                ? (() => {
                                    const selectedItem = items.find(
                                      (item) => item.id === selectedItemId
                                    );
                                    return selectedItem
                                      ? `${selectedItem.code} - ${selectedItem.name}`
                                      : "Select an item";
                                  })()
                                : "Search item..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[520px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search by code or name..." />
                              <CommandList className="max-h-[280px] overflow-y-auto">
                                <CommandEmpty>No item found.</CommandEmpty>
                                <CommandGroup>
                                  {items
                                    .filter((item) => item.isActive)
                                    .map((item) => (
                                      <CommandItem
                                        key={item.id}
                                        value={`${item.code} ${item.name}`}
                                        onSelect={() => {
                                          setSelectedItemId(item.id);
                                          const cost =
                                            item.purchasePrice ??
                                            item.standardCost ??
                                            item.listPrice ??
                                            0;
                                          setPrice(Number(cost).toFixed(2));
                                          setItemOpen(false);
                                          setAddItemError("");
                                        }}
                                        className="flex items-center gap-2"
                                      >
                                        <Check
                                          className={cn(
                                            "h-4 w-4",
                                            selectedItemId === item.id
                                              ? "opacity-100"
                                              : "opacity-0"
                                          )}
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">{item.code}</span>
                                            <span className="truncate text-sm text-muted-foreground">
                                              {item.name}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="ml-4 flex-shrink-0 text-sm font-semibold">
                                          {formatCurrency(item.listPrice)}
                                        </div>
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-gray-700 tracking-wide mb-2">Quantity *</label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={quantity}
                            onChange={(e) => {
                              setQuantity(e.target.value);
                              setAddItemError("");
                            }}
                            step="0.01"
                            className="h-10 text-sm bg-white border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-xs font-semibold text-gray-700 tracking-wide mb-2">Unit Price *</label>
                        <Input
                          key={`unit-price-${selectedItemId}`}
                          type="text"
                          inputMode="decimal"
                          pattern="^-?\\d*(\\.\\d{0,2})?$"
                          placeholder="0.00"
                          value={price ?? ""}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (next === "" || /^-?\\d*(\\.\\d{0,2})?$/.test(next)) {
                              setPrice(next);
                              setAddItemError("");
                            }
                          }}
                          className="h-10 text-sm bg-white border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        />
                        </div>
                        <div className="col-span-2 flex items-end">
                          <Button
                            type="button"
                            onClick={handleAddItem}
                            className="w-full h-10 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 shadow-lg text-sm font-semibold"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Item
                          </Button>
                        </div>
                      </div>

                      {/* Inline Error Message */}
                      {addItemError && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                          <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                          </svg>
                          <p className="text-sm text-red-800 font-medium">{addItemError}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items List */}
                  {lineItems.length > 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-5 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-transparent">
                              <Package className="h-4 w-4 text-gray-600" />
                            </div>
                          <h3 className="text-sm font-semibold text-gray-900">Stock Requisition Items</h3>
                            <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                              {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-gray-500">Total Amount</p>
                            <p className="text-xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                              {formatCurrency(totalAmount)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 border-b border-gray-200">
                              <TableHead className="font-semibold text-xs text-gray-700 h-10">ITEM CODE</TableHead>
                              <TableHead className="font-semibold text-xs text-gray-700 h-10">ITEM NAME</TableHead>
                              <TableHead className="text-right font-semibold text-xs text-gray-700 h-10">QTY</TableHead>
                              <TableHead className="text-right font-semibold text-xs text-gray-700 h-10">UNIT PRICE</TableHead>
                              <TableHead className="text-right font-semibold text-xs text-gray-700 h-10">TOTAL</TableHead>
                              <TableHead className="w-[60px] h-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => (
                              <TableRow key={index} className="hover:bg-purple-50/50 transition-colors border-b border-gray-100">
                                <TableCell className="font-semibold text-gray-900 text-sm py-3">{item.itemCode}</TableCell>
                                <TableCell className="text-gray-700 text-sm py-3">{item.itemName}</TableCell>
                                <TableCell className="text-right tabular-nums text-sm text-gray-900 py-3 font-medium">{item.requestedQty}</TableCell>
                                <TableCell className="text-right tabular-nums text-gray-700 text-sm py-3">
                                  {formatCurrency(item.unitPrice)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-bold text-purple-600 text-sm py-3">
                                  {formatCurrency(item.requestedQty * item.unitPrice)}
                                </TableCell>
                                <TableCell className="py-3">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveItem(index)}
                                    className="hover:bg-red-50 hover:text-red-600 h-8 w-8 p-0 rounded-lg"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-12">
                      <div className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-violet-100">
                          <ShoppingCart className="h-8 w-8 text-purple-600" />
                        </div>
                        <h3 className="mb-2 text-base font-semibold text-gray-900">No items added yet</h3>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto">
                          Start by selecting an item, entering quantity and price, then click &quot;Add Item&quot;
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Fixed Footer */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4">
              <div className="max-w-5xl mx-auto flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {lineItems.length > 0 && (
                    <span>
                      <span className="font-semibold text-gray-900">{lineItems.length}</span> item{lineItems.length !== 1 ? 's' : ''} • Total: <span className="font-semibold text-purple-600">{formatCurrency(totalAmount)}</span>
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="min-w-[100px] h-10 text-sm border-gray-300 hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="min-w-[140px] h-10 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 shadow-lg text-sm font-semibold"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Saving...
                      </span>
                    ) : (
                      <>
                        {isEditMode ? "Update Stock Requisition" : "Create Stock Requisition"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
