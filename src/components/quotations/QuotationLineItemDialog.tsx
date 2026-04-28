"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { useItems } from "@/hooks/useItems";
import { useCurrency } from "@/hooks/useCurrency";
import type { ItemDimensions } from "@/types/item";
import type {
  FrameInvoiceDisplayMode,
  FrameQuotationComponent,
  FrameQuotationConfiguration,
  FrameServiceFeeMode,
} from "@/types/quotation";

const lineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  description: z.string().default(""),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  uomId: z.string().min(1, "Unit of measure is required"),
  uomCode: z.string().optional(),
  uomName: z.string().optional(),
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
});

type LineItemFormInput = z.input<typeof lineItemSchema>;
export type LineItemFormValues = z.output<typeof lineItemSchema> & {
  lineTotal?: number;
  skipInventory?: boolean;
  available?: number;
  reorderPoint?: number;
  frameConfiguration?: FrameQuotationConfiguration | null;
  frameComponents?: FrameQuotationComponent[];
};

type QuotationLineItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: LineItemFormValues) => void;
  item?: LineItemFormValues | null;
  mode?: "add" | "edit";
};

type MaterialItemOption = {
  id: string;
  code: string;
  name: string;
  uom: string;
  uomId: string;
  listPrice: number;
  dimensions?: ItemDimensions | null;
};

type LineItemOption = {
  id: string;
  code: string;
  name: string;
  description?: string;
  uom: string;
  uomId: string;
  uomCode?: string;
  uomName?: string;
  listPrice: number;
  available?: number;
  reorderPoint?: number;
};

type MoldingCutPlanStick = {
  cuts: number[];
  usedLength: number;
  wasteLength: number;
};

type MoldingCutPlan = {
  cuts: number[];
  sticks: MoldingCutPlanStick[];
  sticksRequired: number;
  totalCutLength: number;
  totalWasteLength: number;
};

const buildMoldingCutPlan = ({
  width,
  height,
  allowance,
  frameQuantity,
  stickLength,
}: {
  width: number;
  height: number;
  allowance: number;
  frameQuantity: number;
  stickLength: number;
}): MoldingCutPlan => {
  const wholeFrameQuantity = Math.max(0, Math.floor(frameQuantity));
  const widthCut = width + allowance;
  const heightCut = height + allowance;
  const cuts: number[] = [];

  if (widthCut <= 0 || heightCut <= 0 || stickLength <= 0 || wholeFrameQuantity <= 0) {
    return {
      cuts,
      sticks: [],
      sticksRequired: 0,
      totalCutLength: 0,
      totalWasteLength: 0,
    };
  }

  for (let frameIndex = 0; frameIndex < wholeFrameQuantity; frameIndex += 1) {
    cuts.push(widthCut, widthCut, heightCut, heightCut);
  }

  const sortedCuts = [...cuts].sort((a, b) => b - a);
  const sticks: MoldingCutPlanStick[] = [];

  for (const cut of sortedCuts) {
    const targetStick = sticks.find((stick) => stick.usedLength + cut <= stickLength);

    if (targetStick) {
      targetStick.cuts.push(cut);
      targetStick.usedLength += cut;
      targetStick.wasteLength = stickLength - targetStick.usedLength;
    } else {
      sticks.push({
        cuts: [cut],
        usedLength: cut,
        wasteLength: Math.max(0, stickLength - cut),
      });
    }
  }

  const totalCutLength = cuts.reduce((sum, cut) => sum + cut, 0);

  return {
    cuts,
    sticks,
    sticksRequired: sticks.length,
    totalCutLength,
    totalWasteLength: sticks.reduce((sum, stick) => sum + stick.wasteLength, 0),
  };
};

export function QuotationLineItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
}: QuotationLineItemDialogProps) {
  const t = useTranslations("quotationLineItemDialog");
  const tCommon = useTranslations("common");
  const [itemSearch, setItemSearch] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [debouncedMaterialSearch, setDebouncedMaterialSearch] = useState("");
  const [isFrameJob, setIsFrameJob] = useState(false);
  const [frameWidth, setFrameWidth] = useState(0);
  const [frameHeight, setFrameHeight] = useState(0);
  const [fixedAllowance, setFixedAllowance] = useState(0);
  const [moldingItemId, setMoldingItemId] = useState("");
  const [serviceFeeMode, setServiceFeeMode] = useState<FrameServiceFeeMode>("per_frame");
  const [serviceType, setServiceType] = useState("");
  const [serviceFeeAmount, setServiceFeeAmount] = useState(0);
  const [invoiceDisplayMode, setInvoiceDisplayMode] = useState<FrameInvoiceDisplayMode>("summary");
  const [manualComponents, setManualComponents] = useState<FrameQuotationComponent[]>([]);
  const [pendingManualComponent, setPendingManualComponent] = useState<FrameQuotationComponent>({
    componentType: "material",
    source: "manual",
    itemId: "",
    itemCode: "",
    itemName: "",
    description: "",
    qtyPerFrame: 1,
    totalQuantity: 0,
    uomId: "",
    uomCode: "",
    unitRate: 0,
    totalAmount: 0,
    roundingMode: "none",
    sortOrder: 0,
  });
  const [selectedLineItems, setSelectedLineItems] = useState<Record<string, LineItemOption>>({});
  const [selectedMaterialItems, setSelectedMaterialItems] = useState<
    Record<string, MaterialItemOption>
  >({});
  const { data: basicItemsData } = useItems({
    search: debouncedItemSearch.trim() || undefined,
    limit: 5,
    isActive: true,
    includeStock: true,
  });
  const basicItems = basicItemsData?.data || [];
  const lineItemsById = new Map<string, LineItemOption>();
  for (const lineItem of Object.values(selectedLineItems)) {
    lineItemsById.set(lineItem.id, lineItem);
  }
  for (const itemOption of basicItems) {
    lineItemsById.set(itemOption.id, {
      id: itemOption.id,
      code: itemOption.code,
      name: itemOption.name,
      description: "description" in itemOption ? itemOption.description : "",
      uom: itemOption.uom,
      uomId: itemOption.uomId,
      listPrice: itemOption.listPrice,
      available:
        "available" in itemOption && typeof itemOption.available === "number"
          ? itemOption.available
          : 0,
      reorderPoint:
        "reorderPoint" in itemOption && typeof itemOption.reorderPoint === "number"
          ? itemOption.reorderPoint
          : 0,
    });
  }
  const selectableItems = Array.from(lineItemsById.values());
  const { data: materialItemsData } = useItems({
    search: debouncedMaterialSearch.trim() || undefined,
    limit: 5,
    isActive: true,
  });
  const materialItems = (materialItemsData?.data || []).map(
    (materialItem): MaterialItemOption => ({
      id: materialItem.id,
      code: materialItem.code,
      name: materialItem.name,
      uom: materialItem.uom,
      uomId: materialItem.uomId,
      listPrice: materialItem.listPrice,
      dimensions: "dimensions" in materialItem ? materialItem.dimensions ?? null : null,
    })
  );
  const normalizedMaterialSearch = debouncedMaterialSearch.trim().toLowerCase();
  const matchesMaterialSearch = (materialItem: MaterialItemOption) =>
    !normalizedMaterialSearch ||
    `${materialItem.code} ${materialItem.name}`.toLowerCase().includes(normalizedMaterialSearch);
  const materialItemsById = new Map<string, MaterialItemOption>();
  for (const materialItem of Object.values(selectedMaterialItems)) {
    materialItemsById.set(materialItem.id, materialItem);
  }
  for (const materialItem of materialItems) {
    materialItemsById.set(materialItem.id, materialItem);
  }
  const materialOptions = Array.from(materialItemsById.values()).filter(matchesMaterialSearch);

  const { formatCurrency } = useCurrency();

  // Item combobox state
  const [itemOpen, setItemOpen] = useState(false);
  const [moldingOpen, setMoldingOpen] = useState(false);
  const [pendingComponentItemOpen, setPendingComponentItemOpen] = useState(false);

  const form = useForm<LineItemFormInput>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      uomId: "",
      uomCode: "",
      uomName: "",
      discount: 0,
      taxRate: 0,
    },
  });

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setDebouncedItemSearch(itemSearch.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [itemSearch, open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setDebouncedMaterialSearch(materialSearch.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [materialSearch, open]);

  // Reset form when dialog opens/closes or item changes
  useEffect(() => {
    if (open && item) {
      form.reset(item);
      setSelectedLineItems({
        [item.itemId]: {
          id: item.itemId,
          code: item.itemCode || "",
          name: item.itemName || item.description,
          description: item.description,
          uom: item.uomCode || item.uomName || "",
          uomId: item.uomId,
          uomCode: item.uomCode,
          uomName: item.uomName,
          listPrice: item.unitPrice,
        },
      });
      const config = item.frameConfiguration;
      setIsFrameJob(!!config);
      setFrameWidth(config?.width || 0);
      setFrameHeight(config?.height || 0);
      setFixedAllowance(config?.fixedAllowance || 0);
      setMoldingItemId(config?.moldingItemId || "");
      setServiceFeeMode(config?.serviceFeeMode || "per_frame");
      setServiceType(config?.serviceType || "");
      setServiceFeeAmount(config?.serviceFeeAmount || 0);
      setInvoiceDisplayMode(config?.invoiceDisplayMode || "summary");
      setManualComponents(
        (item.frameComponents || []).filter((component) => component.componentType !== "molding")
      );
      setPendingComponentItemOpen(false);
      setPendingManualComponent({
        componentType: "material",
        source: "manual",
        itemId: "",
        itemCode: "",
        itemName: "",
        description: "",
        qtyPerFrame: 1,
        totalQuantity: 0,
        uomId: "",
        uomCode: "",
        unitRate: 0,
        totalAmount: 0,
        roundingMode: "none",
        sortOrder: 0,
      });
      const seededMaterialItems = (item.frameComponents || []).reduce(
        (acc, component) => {
          acc[component.itemId] = {
            id: component.itemId,
            code: component.itemCode || "",
            name: component.itemName || component.description,
            uom: component.uomCode || "",
            uomId: component.uomId,
            listPrice: component.unitRate,
            dimensions:
              component.componentType === "molding" && config?.moldingStickLength
                ? { length: config.moldingStickLength }
                : null,
          };
          return acc;
        },
        {} as Record<string, MaterialItemOption>
      );
      setSelectedMaterialItems(seededMaterialItems);
    } else if (open) {
      form.reset({
        itemId: "",
        itemCode: "",
        itemName: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        uomId: "",
        uomCode: "",
        uomName: "",
        discount: 0,
        taxRate: 0,
      });
      setIsFrameJob(false);
      setFrameWidth(0);
      setFrameHeight(0);
      setFixedAllowance(0);
      setMoldingItemId("");
      setServiceFeeMode("per_frame");
      setServiceType("");
      setServiceFeeAmount(0);
      setInvoiceDisplayMode("summary");
      setManualComponents([]);
      setPendingComponentItemOpen(false);
      setPendingManualComponent({
        componentType: "material",
        source: "manual",
        itemId: "",
        itemCode: "",
        itemName: "",
        description: "",
        qtyPerFrame: 1,
        totalQuantity: 0,
        uomId: "",
        uomCode: "",
        unitRate: 0,
        totalAmount: 0,
        roundingMode: "none",
        sortOrder: 0,
      });
      setSelectedLineItems({});
      setSelectedMaterialItems({});
    }
  }, [open, item, form]);

  const rememberLineItem = (lineItem: LineItemOption) => {
    setSelectedLineItems((current) => ({
      ...current,
      [lineItem.id]: lineItem,
    }));
  };

  const rememberMaterialItem = (materialItem: MaterialItemOption) => {
    setSelectedMaterialItems((current) => ({
      ...current,
      [materialItem.id]: materialItem,
    }));
  };

  const handleItemSelect = async (itemId: string) => {
    const basicItem = lineItemsById.get(itemId);
    if (basicItem) {
      rememberLineItem(basicItem);
      form.setValue("itemId", basicItem.id);
      form.setValue("itemCode", basicItem.code);
      form.setValue("itemName", basicItem.name);
      form.setValue("description", basicItem.description || "");
      form.setValue("unitPrice", basicItem.listPrice);
      form.setValue("uomId", basicItem.uomId);
      form.setValue("uomCode", basicItem.uom);
      form.setValue("uomName", basicItem.uom);
    }
  };

  const onSubmit = (data: LineItemFormInput) => {
    const parsed = lineItemSchema.parse(data);
    if (isFrameJob) {
      if (frameWidth <= 0 || frameHeight <= 0) {
        toast.error("Frame width and height must be greater than 0.");
        return;
      }

      const hasInvalidComponent = frameComponentsForSave.some(
        (component) =>
          !component.itemId ||
          !component.uomId ||
          component.qtyPerFrame <= 0 ||
          component.totalQuantity <= 0
      );

      if (hasInvalidComponent) {
        toast.error("Each frame component must have an item and a quantity greater than 0.");
        return;
      }
    }

    const frameConfiguration = isFrameJob ? buildFrameConfiguration() : null;
    const frameComponents = isFrameJob ? frameComponentsForSave : [];
    onSave({
      ...parsed,
      unitPrice: isFrameJob ? frameUnitPrice : parsed.unitPrice,
      lineTotal,
      skipInventory: !!frameConfiguration,
      available: selectedLineItem?.available,
      reorderPoint: selectedLineItem?.reorderPoint,
      frameConfiguration,
      frameComponents,
    });
    onOpenChange(false);
  };

  const quantity = form.watch("quantity");
  const selectedItemId = form.watch("itemId");
  const unitPrice = form.watch("unitPrice");
  const discount = form.watch("discount");
  const taxRate = form.watch("taxRate");
  const selectedMoldingItem = materialItemsById.get(moldingItemId);

  const getNumericValue = (value: unknown): number => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getMoldingStickLength = (
    source: {
      dimensions?: ItemDimensions | null;
    } | undefined
  ) =>
    getNumericValue(source?.dimensions?.length) ||
    getNumericValue(source?.dimensions?.height) ||
    getNumericValue(source?.dimensions?.width);

  const frameQuantity = quantity || 0;
  const selectedLineItem = lineItemsById.get(selectedItemId);
  const selectedItemAvailable = selectedLineItem?.available ?? 0;
  const showInventoryWarning =
    !!selectedLineItem &&
    typeof selectedLineItem.available === "number" &&
    quantity > 0 &&
    quantity > selectedItemAvailable;
  const moldingStickLength = getMoldingStickLength(selectedMoldingItem);
  const moldingCutPlan = buildMoldingCutPlan({
    width: frameWidth,
    height: frameHeight,
    allowance: fixedAllowance,
    frameQuantity,
    stickLength: moldingStickLength,
  });
  const moldingSticksRequired = moldingCutPlan.sticksRequired;
  const moldingComponent: FrameQuotationComponent | null =
    selectedMoldingItem && moldingSticksRequired > 0
      ? {
          componentType: "molding",
          source: "auto",
          itemId: selectedMoldingItem.id,
          itemCode: selectedMoldingItem.code,
          itemName: selectedMoldingItem.name,
          description: `${selectedMoldingItem.code} ${selectedMoldingItem.name}`,
          qtyPerFrame: frameQuantity > 0 ? moldingSticksRequired / frameQuantity : 0,
          totalQuantity: moldingSticksRequired,
          uomId: selectedMoldingItem.uomId,
          uomCode: selectedMoldingItem.uom,
          unitRate: selectedMoldingItem.listPrice,
          totalAmount: moldingSticksRequired * selectedMoldingItem.listPrice,
          roundingMode: "ceil_per_order",
          sortOrder: 0,
        }
      : null;

  const normalizedManualComponents = manualComponents.map((component, index) => ({
    ...component,
    totalQuantity: component.qtyPerFrame * frameQuantity,
    totalAmount: component.qtyPerFrame * frameQuantity * component.unitRate,
    sortOrder: index + 1,
  }));
  const frameComponentsForSave = [
    ...(moldingComponent ? [moldingComponent] : []),
    ...normalizedManualComponents,
  ];
  const frameMaterialsTotal = frameComponentsForSave.reduce(
    (sum, component) => sum + component.totalAmount,
    0
  );
  const totalServiceFee =
    serviceFeeMode === "per_frame"
      ? serviceFeeAmount * frameQuantity
      : serviceFeeMode === "size_based"
        ? serviceFeeAmount * frameWidth * frameHeight * frameQuantity
        : serviceFeeMode === "service_type"
          ? serviceFeeAmount * frameQuantity
          : serviceFeeAmount;
  const frameUnitPrice =
    isFrameJob && frameQuantity > 0
      ? (frameMaterialsTotal + totalServiceFee) / frameQuantity
      : unitPrice || 0;

  const buildFrameConfiguration = (): FrameQuotationConfiguration => ({
    width: frameWidth,
    height: frameHeight,
    fixedAllowance,
    moldingItemId: selectedMoldingItem?.id,
    moldingItemCode: selectedMoldingItem?.code,
    moldingItemName: selectedMoldingItem?.name,
    moldingStickLength,
    moldingSticksRequired,
    serviceFeeMode,
    serviceType: serviceType || undefined,
    serviceFeeAmount,
    totalServiceFee,
    invoiceDisplayMode,
  });

  const resetPendingManualComponent = () => {
    setPendingManualComponent({
      componentType: "material",
      source: "manual",
      itemId: "",
      itemCode: "",
      itemName: "",
      description: "",
      qtyPerFrame: 1,
      totalQuantity: 0,
      uomId: "",
      uomCode: "",
      unitRate: 0,
      totalAmount: 0,
      roundingMode: "none",
      sortOrder: 0,
    });
    setPendingComponentItemOpen(false);
  };

  const handleAddManualComponent = () => {
    if (!pendingManualComponent.itemId || !pendingManualComponent.uomId) return;

    setManualComponents((current) => [
      ...current,
      {
        ...pendingManualComponent,
        totalQuantity: frameQuantity,
        totalAmount: frameQuantity * pendingManualComponent.qtyPerFrame * pendingManualComponent.unitRate,
        sortOrder: current.length + 1,
      },
    ]);
    resetPendingManualComponent();
  };

  // Calculate line total
  const effectiveUnitPrice = isFrameJob ? frameUnitPrice : unitPrice || 0;
  const lineSubtotal = (quantity || 0) * effectiveUnitPrice;
  const discountAmount = (lineSubtotal * (discount || 0)) / 100;
  const taxableAmount = lineSubtotal - discountAmount;
  const taxAmount = (taxableAmount * (taxRate || 0)) / 100;
  const lineTotal = taxableAmount + taxAmount;

  const renderMaterialInventoryPicker = ({
    searchKey,
    selectedItemId,
    placeholder,
    open,
    onOpenChange,
    onSelect,
  }: {
    searchKey: string;
    selectedItemId: string;
    placeholder: string;
    open: boolean;
    onOpenChange: (nextOpen: boolean) => void;
    onSelect: (materialItem: MaterialItemOption) => void;
  }) => {
    const selectedItem = materialItemsById.get(selectedItemId);

    return (
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setMaterialSearch("");
            setDebouncedMaterialSearch("");
          }
          onOpenChange(nextOpen);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", !selectedItem && "text-muted-foreground")}
          >
            <span className="truncate">
              {selectedItem ? `${selectedItem.code} - ${selectedItem.name}` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[520px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              key={searchKey}
              value={materialSearch}
              onValueChange={setMaterialSearch}
              placeholder="Search inventory item"
            />
            <div className="max-h-[300px] overflow-y-auto overscroll-contain">
              <CommandList>
                <CommandEmpty>No inventory item found.</CommandEmpty>
                <CommandGroup>
                  {materialOptions.map((materialItem) => (
                    <CommandItem
                      key={materialItem.id}
                      value={`${materialItem.code} ${materialItem.name}`}
                      onSelect={() => {
                        rememberMaterialItem(materialItem);
                        onSelect(materialItem);
                        onOpenChange(false);
                      }}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="flex min-w-0 flex-1 items-start">
                        <Check
                          className={cn(
                            "mr-2 mt-1 h-4 w-4 flex-shrink-0",
                            selectedItemId === materialItem.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{materialItem.code}</span>
                            <span className="truncate text-sm">{materialItem.name}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {materialItem.uom || "No UoM"} · {formatCurrency(materialItem.listPrice)}
                          </div>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const pendingManualComponentAmount =
    pendingManualComponent.qtyPerFrame * frameQuantity * pendingManualComponent.unitRate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{mode === "edit" ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-6 overflow-y-auto px-1">
              <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => {
                  const selectedItem = lineItemsById.get(field.value);
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>{tCommon("item")} *</FormLabel>
                      <Popover open={itemOpen} onOpenChange={setItemOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={itemOpen}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {selectedItem
                                ? `${selectedItem.code} - ${selectedItem.name}`
                                : t("searchItem")}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[600px] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              value={itemSearch}
                              onValueChange={setItemSearch}
                              placeholder={t("itemSearchPlaceholder")}
                            />
                            <div className="max-h-[300px] overflow-y-auto overscroll-contain">
                              <CommandList>
                                <CommandEmpty>{t("noItemFound")}</CommandEmpty>
                                <CommandGroup>
                                  {selectableItems.map((item) => {
                                    const availableQty = item.available ?? 0;
                                    const reorderPoint = item.reorderPoint ?? 0;
                                    return (
                                    <CommandItem
                                      key={item.id}
                                      value={`${item.code} ${item.name}`}
                                      onSelect={() => {
                                        field.onChange(item.id);
                                        handleItemSelect(item.id);
                                        setItemOpen(false);
                                      }}
                                      className="flex items-center justify-between py-2"
                                    >
                                      <div className="flex min-w-0 flex-1 items-start">
                                        <Check
                                          className={cn(
                                            "mr-2 mt-1 h-4 w-4 flex-shrink-0",
                                              field.value === item.id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium">{item.code}</span>
                                              <span className="truncate text-sm">{item.name}</span>
                                            </div>
                                            <div className="mt-0.5 text-xs text-muted-foreground">
                                              <span
                                                className={cn(
                                                  availableQty <= 0
                                                    ? "font-medium text-red-600"
                                                    : availableQty <= reorderPoint
                                                      ? "text-orange-600"
                                                      : ""
                                                )}
                                              >
                                                {t("stockLabel")}: {availableQty.toFixed(2)}{" "}
                                                {item.uom}
                                              </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="ml-4 flex-shrink-0">
                                        <span className="text-sm font-semibold">
                                          {formatCurrency(item.listPrice)}
                                        </span>
                                      </div>
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </div>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {showInventoryWarning ? (
                        <Alert className="mt-2 border-amber-200 bg-amber-50 text-amber-900">
                          <AlertDescription>
                            {t("inventoryWarning", {
                              requested: quantity.toFixed(2),
                              available: selectedItemAvailable.toFixed(2),
                              uom: selectedLineItem?.uom || "",
                            })}
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tCommon("description")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Basic Information Card */}
              <div className="space-y-4 rounded-lg border bg-card p-5">
                <h3 className="border-b pb-2 text-base font-semibold text-foreground">
                  Basic Information
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{t("quantity")} *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unitPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {isFrameJob ? "Calculated unit price" : `${t("unitPrice")} *`}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            disabled={isFrameJob}
                            value={isFrameJob ? frameUnitPrice.toFixed(2) : field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Frame Job Configuration Card */}
              <div className="overflow-hidden rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <div className="border-b border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="frame-job-toggle"
                      checked={isFrameJob}
                      onCheckedChange={(checked) => setIsFrameJob(checked === true)}
                      className="mt-1"
                    />
                    <Label htmlFor="frame-job-toggle" className="flex-1 cursor-pointer">
                      <div className="text-base font-semibold text-foreground">
                        Configure as job order
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Calculate materials from frame size, molding, accessories, and service fee.
                      </div>
                    </Label>
                  </div>
                </div>

                {isFrameJob && (
                  <div className="space-y-6 bg-background/50 p-6">
                    {/* Frame Dimensions Section */}
                    <div className="rounded-lg border bg-card p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <div className="h-1 w-1 rounded-full bg-primary" />
                        Frame Dimensions
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Width
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={frameWidth}
                            onChange={(event) => setFrameWidth(parseFloat(event.target.value) || 0)}
                            className="mt-2 h-11"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Height
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={frameHeight}
                            onChange={(event) =>
                              setFrameHeight(parseFloat(event.target.value) || 0)
                            }
                            className="mt-2 h-11"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Allowance per side
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={fixedAllowance}
                            onChange={(event) =>
                              setFixedAllowance(parseFloat(event.target.value) || 0)
                            }
                            className="mt-2 h-11"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Molding Section */}
                    <div className="rounded-lg border bg-card p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <div className="h-1 w-1 rounded-full bg-primary" />
                        Molding Material
                      </h4>
                      <div className="grid grid-cols-5 gap-4">
                        <div className="col-span-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Inventory item
                          </Label>
                          <div className="mt-2">
                            {renderMaterialInventoryPicker({
                              searchKey: "molding",
                              selectedItemId: moldingItemId,
                              placeholder: "Search molding in inventory",
                              open: moldingOpen,
                              onOpenChange: setMoldingOpen,
                              onSelect: (materialItem) => setMoldingItemId(materialItem.id),
                            })}
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            Molding is a material line marked for automatic stick calculation.
                          </p>
                        </div>
                        <div className="col-span-3 rounded-lg border-2 bg-gradient-to-br from-muted/30 to-muted/60 p-4">
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-muted-foreground">
                                  Stick length
                                </span>
                                <span className="font-semibold">{moldingStickLength || 0}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-muted-foreground">
                                  Required sticks
                                </span>
                                <span className="font-semibold">{moldingSticksRequired}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-muted-foreground">
                                  Cut length
                                </span>
                                <span className="font-semibold">
                                  {moldingCutPlan.totalCutLength.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-muted-foreground">
                                  Estimated waste
                                </span>
                                <span className="font-semibold">
                                  {moldingCutPlan.totalWasteLength.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <div className="-mx-4 flex justify-between rounded border-t-2 bg-background/30 px-4 py-2 pt-2.5 text-sm">
                              <span className="font-bold">Molding amount</span>
                              <span className="text-base font-bold text-primary">
                                {formatCurrency(moldingComponent?.totalAmount || 0)}
                              </span>
                            </div>
                            {moldingCutPlan.sticks.length > 0 && (
                              <div className="border-t pt-3 text-xs">
                                <div className="mb-1.5 font-semibold text-foreground">Cut Plan</div>
                                <div className="custom-scrollbar max-h-24 space-y-1 overflow-y-auto pr-2">
                                  {moldingCutPlan.sticks.slice(0, 8).map((stick, index) => (
                                    <div
                                      key={`${stick.usedLength}-${index}`}
                                      className="font-mono text-muted-foreground"
                                    >
                                      Stick {index + 1}: {stick.cuts.join(" + ")} ={" "}
                                      {stick.usedLength.toFixed(2)}
                                    </div>
                                  ))}
                                  {moldingCutPlan.sticks.length > 8 && (
                                    <div className="italic text-muted-foreground">
                                      +{moldingCutPlan.sticks.length - 8} more...
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Backing, Glass, and Accessories Section */}
                    <div className="rounded-lg border bg-card p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <div className="h-1 w-1 rounded-full bg-primary" />
                          Backing, Glass & Accessories
                        </h4>
                      </div>
                      <div className="rounded-lg border bg-gradient-to-br from-muted/30 to-muted/10 p-5">
                        <div className="mb-4 text-sm font-semibold text-foreground">
                          Add a component
                        </div>
                        <div className="grid grid-cols-12 items-end gap-3">
                          <div className="col-span-4 space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                              Item
                            </Label>
                            {renderMaterialInventoryPicker({
                              searchKey: "new-component",
                              selectedItemId: pendingManualComponent.itemId,
                              placeholder: "Search inventory item",
                              open: pendingComponentItemOpen,
                              onOpenChange: setPendingComponentItemOpen,
                              onSelect: (nextItem) => {
                                setPendingManualComponent((current) => ({
                                  ...current,
                                  itemId: nextItem.id,
                                  itemCode: nextItem.code,
                                  itemName: nextItem.name,
                                  description: `${nextItem.code} ${nextItem.name}`,
                                  uomId: nextItem.uomId,
                                  uomCode: nextItem.uom,
                                  unitRate: nextItem.listPrice,
                                }));
                              },
                            })}
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                              Type
                            </Label>
                            <Select
                              value={pendingManualComponent.componentType}
                              onValueChange={(value) =>
                                setPendingManualComponent((current) => ({
                                  ...current,
                                  componentType: value === "accessory" ? "accessory" : "material",
                                }))
                              }
                            >
                              <SelectTrigger className="h-11">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="material">Material</SelectItem>
                                <SelectItem value="accessory">Accessory</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-1 space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                              Qty/frame
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={pendingManualComponent.qtyPerFrame}
                              onChange={(event) =>
                                setPendingManualComponent((current) => ({
                                  ...current,
                                  qtyPerFrame: parseFloat(event.target.value) || 0,
                                }))
                              }
                              placeholder="1"
                              className="h-11"
                            />
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                              Rate
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={pendingManualComponent.unitRate}
                              onChange={(event) =>
                                setPendingManualComponent((current) => ({
                                  ...current,
                                  unitRate: parseFloat(event.target.value) || 0,
                                }))
                              }
                              placeholder="0"
                              className="h-11"
                            />
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                              Amount
                            </Label>
                            <div className="flex h-11 items-center rounded-md border border-input bg-background px-3">
                              <span className="text-lg font-bold text-primary">
                                {formatCurrency(pendingManualComponentAmount)}
                              </span>
                            </div>
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              size="lg"
                              onClick={handleAddManualComponent}
                              disabled={!pendingManualComponent.itemId}
                              className="h-11 w-full"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {normalizedManualComponents.length === 0 && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          No components added yet. Add a component above to get started.
                        </div>
                      )}
                      {normalizedManualComponents.length > 0 ? (
                        <div className="overflow-hidden rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead className="w-[140px]">Type</TableHead>
                                <TableHead className="w-[120px] text-right">Qty/frame</TableHead>
                                <TableHead className="text-right">Rate</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-[100px] text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {normalizedManualComponents.map((component, index) => (
                                <TableRow key={`${component.itemId}-${index}`}>
                                  <TableCell>
                                    <div>
                                      <div className="font-medium">
                                        {component.itemCode} - {component.itemName}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {component.uomCode || "-"}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={component.componentType}
                                      onValueChange={(value) =>
                                        setManualComponents((current) =>
                                          current.map((c, i) =>
                                            i === index
                                              ? {
                                                  ...c,
                                                  componentType:
                                                    value === "accessory" ? "accessory" : "material",
                                                }
                                              : c
                                          )
                                        )
                                      }
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="material">Material</SelectItem>
                                        <SelectItem value="accessory">Accessory</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={component.qtyPerFrame}
                                      onChange={(e) =>
                                        setManualComponents((current) =>
                                          current.map((c, i) =>
                                            i === index
                                              ? {
                                                  ...c,
                                                  qtyPerFrame: parseFloat(e.target.value) || 0,
                                                }
                                              : c
                                          )
                                        )
                                      }
                                      className="h-9 text-right"
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(component.unitRate)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(component.totalAmount)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setManualComponents((current) =>
                                          current.filter((_, currentIndex) => currentIndex !== index)
                                        )
                                      }
                                    >
                                      Delete
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : null}
                    </div>

                    {/* Service Fee Section */}
                    <div className="rounded-lg border bg-card p-4">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <div className="h-1 w-1 rounded-full bg-primary" />
                        Service Fee & Display
                      </h4>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Service fee mode
                          </Label>
                          <Select
                            value={serviceFeeMode}
                            onValueChange={(value) =>
                              setServiceFeeMode(value as FrameServiceFeeMode)
                            }
                          >
                            <SelectTrigger className="mt-2 h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="per_frame">Per frame</SelectItem>
                              <SelectItem value="per_order">Per order</SelectItem>
                              <SelectItem value="size_based">By frame size</SelectItem>
                              <SelectItem value="service_type">By service type</SelectItem>
                              <SelectItem value="manual">Manual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Service type
                          </Label>
                          <Input
                            value={serviceType}
                            onChange={(event) => setServiceType(event.target.value)}
                            placeholder="Chop and join"
                            className="mt-2 h-11"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Service fee
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={serviceFeeAmount}
                            onChange={(event) =>
                              setServiceFeeAmount(parseFloat(event.target.value) || 0)
                            }
                            className="mt-2 h-11"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Invoice display
                          </Label>
                          <Select
                            value={invoiceDisplayMode}
                            onValueChange={(value) =>
                              setInvoiceDisplayMode(value as FrameInvoiceDisplayMode)
                            }
                          >
                            <SelectTrigger className="mt-2 h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="summary">Summary</SelectItem>
                              <SelectItem value="components">Components</SelectItem>
                              <SelectItem value="both">Both</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Frame Total Summary */}
                    <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 p-5 shadow-lg">
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                          Frame Configuration Summary
                        </h4>
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between border-b border-primary/20 py-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              Materials Total
                            </span>
                            <span className="text-base font-semibold">
                              {formatCurrency(frameMaterialsTotal)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-primary/20 py-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              Service Fee
                            </span>
                            <span className="text-base font-semibold">
                              {formatCurrency(totalServiceFee)}
                            </span>
                          </div>
                          <div className="-mx-5 flex items-center justify-between rounded-b-lg bg-primary/10 px-5 py-3 pt-2">
                            <span className="text-base font-bold">Frame Line Amount</span>
                            <span className="text-xl font-bold text-primary">
                              {formatCurrency(frameMaterialsTotal + totalServiceFee)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing & Totals Card */}
              <div className="space-y-4 rounded-lg border bg-card p-5">
                <h3 className="border-b pb-2 text-base font-semibold text-foreground">
                  Pricing & Totals
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{t("discountRate")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="taxRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{t("taxRate")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Line Total Summary */}
                <div className="mt-4 rounded-xl border-2 bg-gradient-to-br from-slate-50 to-slate-100 p-5 dark:from-slate-900 dark:to-slate-800">
                  <div className="space-y-3">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground">
                      Order Summary
                    </h4>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between py-1.5 text-sm">
                        <span className="font-medium text-muted-foreground">{t("subtotal")}</span>
                        <span className="text-base font-semibold">
                          {formatCurrency(lineSubtotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 text-sm">
                        <span className="font-medium text-destructive">{t("discount")}</span>
                        <span className="text-base font-semibold text-destructive">
                          -{formatCurrency(discountAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b py-1.5 pb-2 text-sm">
                        <span className="font-medium text-muted-foreground">{t("tax")}</span>
                        <span className="text-base font-semibold">{formatCurrency(taxAmount)}</span>
                      </div>
                      <div className="-mx-5 flex items-center justify-between rounded-b-lg bg-primary/10 px-5 py-3 pt-2 dark:bg-primary/20">
                        <span className="text-lg font-bold">{t("lineTotal")}</span>
                        <span className="text-2xl font-bold text-primary">
                          {formatCurrency(lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 -mx-1 mt-6 flex-shrink-0 border-t bg-muted/30 px-6 py-4 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit">{mode === "edit" ? t("updateItem") : t("addItem")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
