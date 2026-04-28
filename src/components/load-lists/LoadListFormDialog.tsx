"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2, Check, ChevronsUpDown, Package, FileText, Truck, Container, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useCreateLoadList, useLoadList, useUpdateLoadList } from "@/hooks/useLoadLists";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useItem, useItems } from "@/hooks/useItems";
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
import { createLoadListFormSchema, type LoadListFormValues } from "@/lib/validations/load-list";
import type { LoadList } from "@/types/load-list";

type LineItem = {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  itemUnitOptionId: string;
  uomId: string;
  uomLabel?: string;
  qtyPerUnit: number;
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
  const t = useTranslations("loadListForm");
  const tValidation = useTranslations("loadListValidation");
  const locale = useLocale();
  const isEditMode = !!loadList;
  const { formatCurrency } = useCurrency();
  const createMutation = useCreateLoadList();
  const updateMutation = useUpdateLoadList();
  const { data: loadListDetails } = useLoadList(loadList?.id ?? "");
  const resolvedLoadList = loadListDetails ?? loadList;

  const { data: suppliersData } = useSuppliers({ limit: 50 });
  const suppliers = suppliersData?.data || [];

  const { data: warehousesData } = useWarehouses({ limit: 50 });
  const warehouses = warehousesData?.data || [];

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedUnitOptionId, setSelectedUnitOptionId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [activeTab, setActiveTab] = useState("general");
  const [itemOpen, setItemOpen] = useState(false);
  const [itemSearchInput, setItemSearchInput] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const isSearchingItems = debouncedItemSearch.trim().length > 0;
  const { data: preloadItemsData } = useItems({
    limit: 5,
    enabled: open && activeTab === "items" && !isSearchingItems,
  });
  const { data: searchedItemsData } = useItems({
    search: debouncedItemSearch.trim(),
    limit: 5,
    enabled: open && activeTab === "items" && isSearchingItems,
  });
  const items = useMemo(
    () => (isSearchingItems ? searchedItemsData?.data || [] : preloadItemsData?.data || []),
    [isSearchingItems, preloadItemsData?.data, searchedItemsData?.data]
  );
  const llFormSchema = createLoadListFormSchema((key) => tValidation(key));
  const { data: selectedItemResponse } = useItem(selectedItemId);
  const selectedItemDetail = selectedItemResponse?.data;
  const unitOptions = (selectedItemDetail?.unitOptions || []).filter((option) => option.isActive);
  const selectedUnitOption =
    unitOptions.find((option) => option.id === selectedUnitOptionId) ||
    selectedItemDetail?.unitOptions?.find((option) => option.id === selectedUnitOptionId) ||
    null;
  const selectedItemRecord = selectedItemDetail || items.find((item) => item.id === selectedItemId) || null;
  const selectedQtyPerUnit = selectedUnitOption?.qtyPerUnit ?? 1;
  const selectedUomLabel =
    selectedUnitOption?.displayLabel ||
    selectedItemDetail?.uom ||
    items.find((item) => item.id === selectedItemId)?.uom ||
    "";
  const selectedTotalQty = Number(quantity || 0) * selectedQtyPerUnit;
  const selectedItemLabel = selectedItemId
    ? selectedItemDetail
      ? `${selectedItemDetail.code} - ${selectedItemDetail.name}`
      : (() => {
          const selectedItem = items.find((item) => item.id === selectedItemId);
          return selectedItem ? `${selectedItem.code} - ${selectedItem.name}` : t("selectItem");
        })()
    : t("searchItem");

  // Default values
  const defaultValues = useMemo<LoadListFormValues>(
    () => ({
      supplierId: "",
      warehouseId: "",
      supplierLlNumber: "",
      containerNumber: "",
      sealNumber: "",
      batchNumber: "",
      linerName: "",
      estimatedArrivalDate: "",
      loadDate: new Date().toISOString().split("T")[0],
      notes: "",
    }),
    []
  );

  const form = useForm<LoadListFormValues>({
    resolver: zodResolver(llFormSchema),
    defaultValues,
  });

  // Calculate total
  const totalAmount = useMemo(() => {
    return lineItems.reduce(
      (sum, item) => sum + item.loadListQty * item.qtyPerUnit * item.unitPrice,
      0
    );
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
        linerName: resolvedLoadList.linerName || "",
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
          itemUnitOptionId: item.itemUnitOptionId || item.itemUnitOption?.id || "",
          uomId: item.uomId || "",
          uomLabel: item.itemUnitOption?.displayLabel || item.uomCode || "",
          qtyPerUnit: item.itemUnitOption?.qtyPerUnit ?? 1,
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
      setSelectedUnitOptionId("");
      setItemSearchInput("");
      setDebouncedItemSearch("");
      setQuantity("");
      setUnitCost("");
      setActiveTab("general");
    }
  }, [open, resolvedLoadList, form, defaultValues]);

  useEffect(() => {
    if (!selectedItemDetail) {
      setSelectedUnitOptionId("");
      return;
    }

    const fallbackUnitOption =
      unitOptions.find((option) => option.isDefault) ||
      unitOptions.find((option) => option.isBase) ||
      unitOptions[0];

    if (!fallbackUnitOption) {
      setSelectedUnitOptionId("");
      return;
    }

    setSelectedUnitOptionId((currentValue) => {
      if (currentValue && unitOptions.some((option) => option.id === currentValue)) {
        return currentValue;
      }

      return fallbackUnitOption.id;
    });
  }, [selectedItemDetail, unitOptions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedItemSearch(itemSearchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [itemSearchInput]);

  const handleAddItem = () => {
    if (!selectedItemId || !selectedUnitOptionId || !quantity || unitCost === "") {
      toast.error(t("addItemError"));
      return;
    }

    const selectedItem = selectedItemRecord;
    if (!selectedItem) {
      toast.error(t("itemNotFound"));
      return;
    }

    if (!selectedUnitOption) {
      toast.error(t("unitNotFound"));
      return;
    }

    const newItem: LineItem = {
      itemId: selectedItemId,
      itemCode: selectedItem.code,
      itemName: selectedItem.name,
      itemUnitOptionId: selectedUnitOption.id,
      uomId: selectedUnitOption.uomId,
      uomLabel: selectedUomLabel,
      qtyPerUnit: selectedQtyPerUnit,
      loadListQty: parseFloat(quantity),
      unitPrice: parseFloat(unitCost),
    };

    setLineItems([...lineItems, newItem]);
    setSelectedItemId("");
    setSelectedUnitOptionId("");
    setItemSearchInput("");
    setDebouncedItemSearch("");
    setQuantity("");
    setUnitCost("");
  };

  const handleRemoveItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  async function onSubmit(values: LoadListFormValues) {
    if (lineItems.length === 0) {
      toast.error(t("lineItemsRequired"));
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
        linerName: values.linerName,
        estimatedArrivalDate: values.estimatedArrivalDate,
        loadDate: values.loadDate,
        notes: values.notes,
        items: lineItems.map((item) => ({
          itemId: item.itemId,
          itemUnitOptionId: item.itemUnitOptionId,
          uomId: item.uomId,
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
        toast.success(t("updateSuccess"));
      } else {
        await createMutation.mutateAsync(requestData);
        toast.success(t("createSuccess"));
      }

      onOpenChange(false);
      form.reset();
      setLineItems([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  }

  useEffect(() => {
    if (!selectedItemId) return;
    const selectedItem = selectedItemRecord;
    if (!selectedItem) return;
    const cost =
      selectedItem.purchasePrice ??
      selectedItem.standardCost ??
      selectedItem.listPrice ??
      0;
    setUnitCost(Number(cost).toFixed(2));
  }, [selectedItemId, selectedItemRecord]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-4 pb-3 border-b bg-gradient-to-r from-purple-50 to-violet-50">
          <div className="flex items-center gap-2.5">
            <div>
              <DialogTitle className="text-xl font-bold">
                {isEditMode ? t("editTitle") : t("createTitle")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isEditMode
                  ? t("editDescription")
                  : t("createDescription")}
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
                    {t("generalTab")}
                  </TabsTrigger>
                  <TabsTrigger value="items" className="gap-1.5 text-xs font-semibold">
                    <Package className="h-3.5 w-3.5" />
                    {t("itemsTab")} {lineItems.length > 0 && (
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
                    <h3 className="text-sm font-semibold text-gray-900">{t("primaryInformation")}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="supplierId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">{t("supplierLabel")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder={t("selectSupplier")} />
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
                          <FormLabel className="text-xs font-medium">{t("warehouseLabel")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder={t("selectWarehouse")} />
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
                          <FormLabel className="text-xs font-medium">{t("supplierLoadListNumber")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("supplierLoadListPlaceholder")}
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
                          <FormLabel className="text-xs font-medium">{t("loadDate")}</FormLabel>
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
                    <h3 className="text-sm font-semibold text-gray-900">{t("containerDetails")}</h3>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="containerNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">{t("containerNumber")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("containerNumberPlaceholder")} {...field} className="h-9 text-sm" />
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
                          <FormLabel className="text-xs font-medium">{t("sealNumber")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("sealNumberPlaceholder")} {...field} className="h-9 text-sm" />
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
                          <FormLabel className="text-xs font-medium">{t("batchNumber")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("batchNumberPlaceholder")} {...field} className="h-9 text-sm" />
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
                          <FormLabel className="text-xs font-medium">{t("estimatedArrivalDate")}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-9 text-sm" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="linerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">{t("linerName")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("linerNamePlaceholder")}
                              {...field}
                              className="h-9 text-sm"
                            />
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
                    <h3 className="text-sm font-semibold text-gray-900">{t("notes")}</h3>
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
                            placeholder={t("notesPlaceholder")}
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
                    <h3 className="text-sm font-semibold text-gray-900">{t("addItemsTitle")}</h3>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,2.8fr)_minmax(0,1.75fr)_100px_120px_120px_150px_160px]">
                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-gray-700 tracking-wide mb-2 block">{t("itemLabel")}</label>
                    <Popover
                      open={itemOpen}
                      onOpenChange={(nextOpen) => {
                        setItemOpen(nextOpen);
                        if (!nextOpen) {
                          setItemSearchInput("");
                          setDebouncedItemSearch("");
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={itemOpen}
                          className={cn(
                            "w-full min-w-0 justify-between h-10 text-sm bg-white border-gray-300 hover:border-purple-400",
                            !selectedItemId && "text-muted-foreground"
                          )}
                        >
                          <span className="min-w-0 truncate text-left">{selectedItemLabel}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[520px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            value={itemSearchInput}
                            onValueChange={setItemSearchInput}
                            placeholder={t("searchByCodeOrName")}
                          />
                          <CommandList className="max-h-[260px] overflow-y-auto">
                            <CommandEmpty>{t("noItemFound")}</CommandEmpty>
                            <CommandGroup>
                              {items
                                .filter((item) => item.isActive)
                                .map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={item.id}
                                    onSelect={() => {
                                      const cost =
                                        item.purchasePrice ??
                                        item.standardCost ??
                                        item.listPrice ??
                                        0;
                                      setSelectedItemId(item.id);
                                      setSelectedUnitOptionId("");
                                      setUnitCost(Number(cost).toFixed(2));
                                      setItemSearchInput("");
                                      setDebouncedItemSearch("");
                                      setItemOpen(false);
                                    }}
                                    className="flex items-start gap-2 py-2"
                                  >
                                    <Check
                                      className={cn(
                                        "mt-0.5 h-4 w-4 shrink-0",
                                        selectedItemId === item.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium">{item.code}</div>
                                      <div className="text-sm text-muted-foreground whitespace-normal break-words leading-snug">
                                        {item.name}
                                      </div>
                                    </div>
                                    <div className="ml-4 flex-shrink-0 self-start text-sm font-semibold">
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
                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-gray-700 tracking-wide mb-2 block">{t("unitLabel")}</label>
                    <Select
                      value={selectedUnitOptionId}
                      onValueChange={setSelectedUnitOptionId}
                      disabled={!selectedItemId || unitOptions.length === 0}
                    >
                      <SelectTrigger className="h-10 text-sm bg-white border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                        <SelectValue
                          placeholder={selectedItemId ? t("selectUnit") : t("selectItemFirst")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {unitOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.displayLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 tracking-wide mb-2 block">{t("qtyPerUnitLabel")}</label>
                    <Input
                      value={
                        selectedUomLabel
                          ? selectedQtyPerUnit.toLocaleString(locale, {
                              maximumFractionDigits: 4,
                            })
                          : ""
                      }
                      readOnly
                      placeholder="--"
                      className="h-10 text-sm bg-gray-50 border-gray-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 tracking-wide mb-2 block">{t("quantityLabel")}</label>
                    <Input
                      type="number"
                      placeholder={t("quantityPlaceholder")}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      step="0.01"
                      className="h-10 text-sm bg-white border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 tracking-wide mb-2 block">{t("totalQtyLabel")}</label>
                    <Input
                      value={
                        selectedUomLabel
                          ? selectedTotalQty.toLocaleString(locale, {
                              maximumFractionDigits: 4,
                            })
                          : ""
                      }
                      readOnly
                      placeholder="--"
                      className="h-10 text-sm bg-gray-50 border-gray-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 tracking-wide mb-2 block">{t("unitCostLabel")}</label>
                    <Input
                      key={`unit-cost-${selectedItemId}`}
                      type="text"
                      inputMode="decimal"
                      pattern="^-?\\d*(\\.\\d{0,2})?$"
                      placeholder={t("unitCostPlaceholder")}
                      value={unitCost}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === "" || /^-?\d*(\.\d{0,2})?$/.test(next)) {
                          setUnitCost(next);
                        }
                      }}
                      className="h-10 text-sm bg-white border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full h-10 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 shadow-lg text-sm font-semibold"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("addItem")}
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
                              <TableHead className="font-semibold text-xs h-8">{t("itemCode")}</TableHead>
                              <TableHead className="font-semibold text-xs h-8">{t("itemName")}</TableHead>
                              <TableHead className="font-semibold text-xs h-8">{t("unitWithQtyPerUnitLabel")}</TableHead>
                              <TableHead className="text-right font-semibold text-xs h-8">{t("qty")}</TableHead>
                              <TableHead className="text-right font-semibold text-xs h-8">{t("totalQtyLabel")}</TableHead>
                              <TableHead className="text-right font-semibold text-xs h-8">{t("unitCostLabel")}</TableHead>
                              <TableHead className="text-right font-semibold text-xs h-8">{t("total")}</TableHead>
                              <TableHead className="w-[50px] h-8"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lineItems.map((item, index) => (
                              <TableRow key={index} className="hover:bg-gray-50 transition-colors h-9">
                                <TableCell className="font-medium text-gray-900 text-xs py-2">{item.itemCode}</TableCell>
                                <TableCell className="text-gray-700 text-xs py-2">{item.itemName}</TableCell>
                                <TableCell className="text-gray-700 text-xs py-2">
                                  <div className="font-medium">
                                    {item.uomLabel || "--"}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {t("qtyPerUnitInlineLabel", {
                                      qty: item.qtyPerUnit.toLocaleString(locale, {
                                        maximumFractionDigits: 4,
                                      }),
                                    })}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs py-2">{item.loadListQty}</TableCell>
                                <TableCell className="text-right tabular-nums text-xs py-2">
                                  {(item.loadListQty * item.qtyPerUnit).toLocaleString(locale, {
                                    maximumFractionDigits: 4,
                                  })}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-gray-700 text-xs py-2">
                                  {formatCurrency(item.unitPrice)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold text-purple-600 text-xs py-2">
                                  {formatCurrency(item.loadListQty * item.qtyPerUnit * item.unitPrice)}
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
                              <p className="text-xs text-gray-600 font-medium">{t("totalAmount")}</p>
                              <p className="text-[10px] text-gray-500">{lineItems.length}</p>
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
                        <h3 className="mb-1 text-sm font-semibold text-gray-900">{t("noItemsTitle")}</h3>
                        <p className="text-xs text-gray-500">{t("noItemsDescription")}</p>
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
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="min-w-[110px] h-9 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 shadow-md shadow-purple-500/20 text-sm"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <span className="flex items-center gap-1.5">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      {t("saving")}
                    </span>
                  ) : isEditMode ? (
                    t("updateAction")
                  ) : (
                    t("createAction")
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
