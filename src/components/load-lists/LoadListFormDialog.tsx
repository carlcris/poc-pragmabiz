"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Check, ChevronsUpDown, Package, FileText, Truck, Container, DollarSign } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useCreateLoadList, useLoadList, useUpdateLoadList } from "@/hooks/useLoadLists";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useItems } from "@/hooks/useItems";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import type { LoadList } from "@/types/load-list";

const llFormSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  supplierLlNumber: z.string().optional(),
  containerNumber: z.string().optional(),
  sealNumber: z.string().optional(),
  batchNumber: z.string().optional(),
  estimatedArrivalDate: z.string().optional(),
  loadDate: z.string().optional(),
  notes: z.string().optional(),
});

type LLFormValues = z.infer<typeof llFormSchema>;

type LineItem = {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  loadListQty: number;
  unitPrice: number;
  notes?: string;
};

type LoadListFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadList?: LoadList | null;
};

export function LoadListFormDialog({ open, onOpenChange, loadList }: LoadListFormDialogProps) {
  const isEditMode = !!loadList;
  const { formatCurrency } = useCurrency();
  const createMutation = useCreateLoadList();
  const updateMutation = useUpdateLoadList();
  const { data: loadListDetails } = useLoadList(loadList?.id ?? "");
  const resolvedLoadList = loadListDetails ?? loadList;

  const { data: suppliersData } = useSuppliers({ limit: 1000 });
  const suppliers = suppliersData?.data || [];

  const { data: warehousesData } = useWarehouses({ limit: 1000 });
  const warehouses = warehousesData?.data || [];

  const { data: itemsData } = useItems({ limit: 1000 });
  const items = useMemo(() => itemsData?.data || [], [itemsData?.data]);

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [activeTab, setActiveTab] = useState("general");
  const [itemOpen, setItemOpen] = useState(false);

  // Default values
  const defaultValues = useMemo<LLFormValues>(
    () => ({
      supplierId: "",
      warehouseId: "",
      supplierLlNumber: "",
      containerNumber: "",
      sealNumber: "",
      batchNumber: "",
      estimatedArrivalDate: "",
      loadDate: new Date().toISOString().split("T")[0],
      notes: "",
    }),
    []
  );

  const form = useForm<LLFormValues>({
    resolver: zodResolver(llFormSchema),
    defaultValues,
  });

  // Calculate total
  const totalAmount = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.loadListQty * item.unitPrice, 0);
  }, [lineItems]);

  // Reset form when dialog opens/closes or LL changes
  useEffect(() => {
    if (open && resolvedLoadList) {
      form.reset({
        supplierId: resolvedLoadList.supplierId,
        warehouseId: resolvedLoadList.warehouseId,
        supplierLlNumber: resolvedLoadList.supplierLlNumber || "",
        containerNumber: resolvedLoadList.containerNumber || "",
        sealNumber: resolvedLoadList.sealNumber || "",
        batchNumber: resolvedLoadList.batchNumber || "",
        estimatedArrivalDate: resolvedLoadList.estimatedArrivalDate?.split("T")[0] || "",
        loadDate: resolvedLoadList.loadDate?.split("T")[0] || "",
        notes: resolvedLoadList.notes || "",
      });
      // Convert LL line items to form format
      const formLineItems: LineItem[] =
        resolvedLoadList.items?.map((item) => ({
          itemId: item.itemId,
          itemCode: item.item?.code,
          itemName: item.item?.name,
          loadListQty: item.loadListQty,
          unitPrice: item.unitPrice,
          notes: item.notes,
        })) || [];
      setLineItems(formLineItems);
      setActiveTab("general");
    } else if (open) {
      form.reset(defaultValues);
      setLineItems([]);
      setSelectedItemId("");
      setQuantity("");
      setUnitCost("");
      setActiveTab("general");
    }
  }, [open, resolvedLoadList, form, defaultValues]);

  const handleAddItem = () => {
    if (!selectedItemId || !quantity || unitCost === "") {
      toast.error("Please select an item and enter quantity and unit cost");
      return;
    }

    const selectedItem = items.find((i) => i.id === selectedItemId);
    if (!selectedItem) {
      toast.error("Item not found");
      return;
    }

    const newItem: LineItem = {
      itemId: selectedItemId,
      itemCode: selectedItem.code,
      itemName: selectedItem.name,
      loadListQty: parseFloat(quantity),
      unitPrice: parseFloat(unitCost),
    };

    setLineItems([...lineItems, newItem]);
    setSelectedItemId("");
    setQuantity("");
    setUnitCost("");
  };

  const handleRemoveItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  async function onSubmit(values: LLFormValues) {
    if (lineItems.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }

    try {
      const requestData = {
        supplierId: values.supplierId,
        warehouseId: values.warehouseId,
        supplierLlNumber: values.supplierLlNumber,
        containerNumber: values.containerNumber,
        sealNumber: values.sealNumber,
        batchNumber: values.batchNumber,
        estimatedArrivalDate: values.estimatedArrivalDate,
        loadDate: values.loadDate,
        notes: values.notes,
        items: lineItems.map((item) => ({
          itemId: item.itemId,
          loadListQty: item.loadListQty,
          unitPrice: item.unitPrice,
          notes: item.notes,
        })),
      };

      if (isEditMode) {
        await updateMutation.mutateAsync({
          id: loadList.id,
          data: requestData,
        });
        toast.success("Load List updated successfully");
      } else {
        await createMutation.mutateAsync(requestData);
        toast.success("Load List created successfully");
      }

      onOpenChange(false);
      form.reset();
      setLineItems([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save load list");
    }
  }

  useEffect(() => {
    if (!selectedItemId) return;
    const selectedItem = items.find((item) => item.id === selectedItemId);
    if (!selectedItem) return;
    const cost =
      selectedItem.purchasePrice ??
      selectedItem.standardCost ??
      selectedItem.listPrice ??
      0;
    setUnitCost(Number(cost).toFixed(2));
  }, [items, selectedItemId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-4 pb-3 border-b bg-gradient-to-r from-purple-50 to-violet-50">
          <div className="flex items-center gap-2.5">
            <div>
              <DialogTitle className="text-xl font-bold">
                {isEditMode ? "Edit Load List" : "Create Load List"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isEditMode
                  ? "Update load list details and line items"
                  : "Fill in the details to create a new load list"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col min-h-0"
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex flex-1 flex-col min-h-0"
            >
              <div className="px-5 pt-3 flex-shrink-0">
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

              <TabsContent value="general" className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-3">
                {/* Primary Information */}
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100">
                      <Truck className="h-3.5 w-3.5 text-purple-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Primary Information</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="supplierId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Supplier *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
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
                      name="warehouseId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Warehouse *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select warehouse" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {warehouses.map((warehouse) => (
                                <SelectItem key={warehouse.id} value={warehouse.id}>
                                  {warehouse.name} ({warehouse.code})
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
                      name="supplierLlNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Supplier LL Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Supplier's load list number"
                              {...field}
                              className="h-9 text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="loadDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Load Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-9 text-sm" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>
                </div>

                {/* Shipping Details */}
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100">
                      <Container className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Shipping Details</h3>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <FormField
                      control={form.control}
                      name="containerNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Container Number</FormLabel>
                          <FormControl>
                            <Input placeholder="CONT-001" {...field} className="h-9 text-sm" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sealNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Seal Number</FormLabel>
                          <FormControl>
                            <Input placeholder="SEAL-001" {...field} className="h-9 text-sm" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="batchNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Batch Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Batch reference" {...field} className="h-9 text-sm" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="estimatedArrivalDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Estimated Arrival</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-9 text-sm" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Additional Notes */}
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100">
                      <FileText className="h-3.5 w-3.5 text-gray-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
                  </div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={2}
                            placeholder="Enter any additional notes..."
                            className="resize-none text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="items" className="flex-1 flex min-h-0 flex-col overflow-hidden px-5 py-3 space-y-3">
                {/* Add Item Section */}
                <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-3 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100">
                      <Plus className="h-3.5 w-3.5 text-purple-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Add Item</h3>
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <label className="text-xs font-medium mb-1 block">Item</label>
                    <Popover open={itemOpen} onOpenChange={setItemOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={itemOpen}
                          className={cn(
                            "w-full justify-between h-9 text-sm",
                            !selectedItemId && "text-muted-foreground"
                          )}
                        >
                          {selectedItemId
                            ? (() => {
                                const selectedItem = items.find((i) => i.id === selectedItemId);
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
                          <CommandList className="max-h-[260px] overflow-y-auto">
                            <CommandEmpty>No item found.</CommandEmpty>
                            <CommandGroup>
                              {items
                                .filter((item) => item.isActive)
                                .map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={`${item.code} ${item.name}`}
                                    onSelect={() => {
                                      const cost =
                                        item.purchasePrice ??
                                        item.standardCost ??
                                        item.listPrice ??
                                        0;
                                      setSelectedItemId(item.id);
                                      setUnitCost(Number(cost).toFixed(2));
                                      setItemOpen(false);
                                    }}
                                    className="flex items-center gap-2"
                                  >
                                    <Check
                                      className={cn(
                                        "h-4 w-4",
                                        selectedItemId === item.id ? "opacity-100" : "opacity-0"
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
                                      {formatCurrency(
                                        item.purchasePrice ??
                                          item.standardCost ??
                                          item.listPrice ??
                                          0
                                      )}
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
                    <label className="text-xs font-medium mb-1 block">Quantity</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      step="0.01"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs font-medium mb-1 block">Unit Cost</label>
                    <Input
                      key={`unit-cost-${selectedItemId}`}
                      type="text"
                      inputMode="decimal"
                      pattern="^-?\\d*(\\.\\d{0,2})?$"
                      placeholder="0.00"
                      value={unitCost}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === "" || /^-?\d*(\.\d{0,2})?$/.test(next)) {
                          setUnitCost(next);
                        }
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full h-9 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 shadow-md text-sm"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                </div>
                </div>

                {/* Line Items Table */}
                <div className="flex min-h-0 flex-1 flex-col">
                  {lineItems.length > 0 ? (
                    <div className="flex flex-col flex-1 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                      <div className="flex-1 overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-gray-50 z-10">
                            <TableRow className="border-b">
                              <TableHead className="font-semibold text-xs h-8">Item Code</TableHead>
                              <TableHead className="font-semibold text-xs h-8">Item Name</TableHead>
                              <TableHead className="text-right font-semibold text-xs h-8">Qty</TableHead>
                              <TableHead className="text-right font-semibold text-xs h-8">Unit Cost</TableHead>
                              <TableHead className="text-right font-semibold text-xs h-8">Total</TableHead>
                              <TableHead className="w-[50px] h-8"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => (
                              <TableRow key={index} className="hover:bg-gray-50 transition-colors h-9">
                                <TableCell className="font-medium text-gray-900 text-xs py-2">{item.itemCode}</TableCell>
                                <TableCell className="text-gray-700 text-xs py-2">{item.itemName}</TableCell>
                                <TableCell className="text-right tabular-nums text-xs py-2">{item.loadListQty}</TableCell>
                                <TableCell className="text-right tabular-nums text-gray-700 text-xs py-2">
                                  {formatCurrency(item.unitPrice)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold text-purple-600 text-xs py-2">
                                  {formatCurrency(item.loadListQty * item.unitPrice)}
                                </TableCell>
                                <TableCell className="py-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveItem(index)}
                                    className="hover:bg-red-50 hover:text-red-600 h-7 w-7 p-0"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Total Section */}
                      <div className="border-t bg-gradient-to-r from-purple-50 to-violet-50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-purple-600 to-violet-600">
                              <DollarSign className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 font-medium">Total Amount</p>
                              <p className="text-[10px] text-gray-500">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                              {formatCurrency(totalAmount)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 p-8">
                      <div className="text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                        <h3 className="mb-1 text-sm font-semibold text-gray-900">No items added</h3>
                        <p className="text-xs text-gray-500">Add items using the form above</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="border-t bg-gray-50 px-5 py-3 flex-shrink-0 mt-auto">
              <div className="flex w-full justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="min-w-[90px] h-9 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="min-w-[110px] h-9 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 shadow-md shadow-purple-500/20 text-sm"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <span className="flex items-center gap-1.5">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      Saving...
                    </span>
                  ) : isEditMode ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
