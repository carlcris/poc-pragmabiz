"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCreateItem, useItem, useUpdateItem } from "@/hooks/useItems";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useUnitsOfMeasure } from "@/hooks/useUnitsOfMeasure";
import { useAuthStore } from "@/stores/authStore";
import { createItemFormSchema } from "@/lib/validations/item";
import type { z } from "zod";
import {
  Package,
  Tag,
  DollarSign,
  BarChart3,
  Image as ImageIcon,
  Info
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
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
import { PricesTab } from "@/components/items/prices/PricesTab";
import { LocationsTab } from "@/components/items/locations/LocationsTab";
import { ImageUpload } from "@/components/ui/image-upload";
import type { Item } from "@/types/item";

export type ItemDialogMode = "create" | "view" | "edit";

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  itemId?: string | null;
  mode?: ItemDialogMode;
}

export function ItemFormDialog({ open, onOpenChange, item, itemId, mode }: ItemFormDialogProps) {
  const t = useTranslations("itemDialog");
  const tValidation = useTranslations("itemValidation");
  const { user } = useAuthStore();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const { data: categoriesData } = useItemCategories();
  const { data: uomsData } = useUnitsOfMeasure();
  const { data: itemResponse, isLoading: itemLoading, error: itemError } = useItem(itemId ?? "");
  const resolvedItem = itemResponse?.data ?? item ?? null;
  const [activeTab, setActiveTab] = useState("general");
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [dialogMode, setDialogMode] = useState<ItemDialogMode>("create");
  const itemFormSchema = createItemFormSchema((key) => tValidation(key));
  const categories = useMemo(() => categoriesData?.data || [], [categoriesData?.data]);
  const unitsOfMeasure = useMemo(
    () => (uomsData?.data || []).filter((unit) => unit.isActive !== false),
    [uomsData?.data]
  );
  type ItemFormInput = z.input<typeof itemFormSchema>;

  const itemTypes = useMemo(
    () => [
      { value: "raw_material", label: t("rawMaterial") },
      { value: "finished_good", label: t("finishedGood") },
      { value: "asset", label: t("asset") },
      { value: "service", label: t("service") },
    ] as const,
    [t]
  );

  const form = useForm<ItemFormInput>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      code: "",
      name: "",
      chineseName: "",
      description: "",
      itemType: "raw_material",
      uom: "",
      category: "",
      standardCost: 0,
      listPrice: 0,
      reorderLevel: 0,
      reorderQty: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;

    const nextMode: ItemDialogMode = mode ?? (resolvedItem ? "edit" : "create");
    setDialogMode(nextMode);

    if (resolvedItem) {
      setIsEditingExisting(true);
      setCreatedItemId(resolvedItem.id);
      form.reset({
        code: resolvedItem.code,
        name: resolvedItem.name,
        chineseName: resolvedItem.chineseName || "",
        description: resolvedItem.description,
        itemType: resolvedItem.itemType,
        uom: resolvedItem.uom,
        category: resolvedItem.category,
        standardCost: resolvedItem.standardCost,
        listPrice: resolvedItem.listPrice,
        reorderLevel: resolvedItem.reorderLevel,
        reorderQty: resolvedItem.reorderQty,
        imageUrl: resolvedItem.imageUrl,
        isActive: resolvedItem.isActive,
      });
    } else {
      setIsEditingExisting(false);
      setCreatedItemId(null);
      form.reset({
        code: "",
        name: "",
        chineseName: "",
        description: "",
        itemType: "raw_material",
        uom: "",
        category: "",
        standardCost: 0,
        listPrice: 0,
        reorderLevel: 0,
        reorderQty: 0,
        imageUrl: undefined,
        isActive: true,
      });
      setActiveTab("general");
    }
  }, [open, mode, resolvedItem, form]);

  useEffect(() => {
    if (!open || resolvedItem) return;
    if (unitsOfMeasure.length === 0) return;
    const currentUom = form.getValues("uom");
    const hasMatch = unitsOfMeasure.some((unit) => unit.code === currentUom);
    if (!currentUom || !hasMatch) {
      form.setValue("uom", unitsOfMeasure[0].code);
    }
  }, [open, resolvedItem, unitsOfMeasure, form]);

  useEffect(() => {
    if (!open || resolvedItem) return;
    if (categories.length === 0) return;
    const currentCategory = form.getValues("category");
    const hasMatch = categories.some((category) => category.name === currentCategory);
    if (!currentCategory || !hasMatch) {
      form.setValue("category", categories[0].name);
    }
  }, [open, resolvedItem, categories, form]);

  const onSubmit = async (values: ItemFormInput) => {
    try {
      const parsed = itemFormSchema.parse(values);
      const payload = {
        ...parsed,
        description: parsed.description ?? "",
        standardCost: parsed.standardCost ?? 0,
        reorderLevel: parsed.reorderLevel ?? 0,
        reorderQty: parsed.reorderQty ?? 0,
      };
      if (resolvedItem) {
        // Update existing item
        const updated = await updateItem.mutateAsync({
          id: resolvedItem.id,
          data: payload,
        });
        const updatedItem = updated?.data;
        if (updatedItem) {
          form.reset({
            code: updatedItem.code,
            name: updatedItem.name,
            chineseName: updatedItem.chineseName || "",
            description: updatedItem.description,
            itemType: updatedItem.itemType,
            uom: updatedItem.uom,
            category: updatedItem.category,
            standardCost: updatedItem.standardCost,
            listPrice: updatedItem.listPrice,
            reorderLevel: updatedItem.reorderLevel,
            reorderQty: updatedItem.reorderQty,
            imageUrl: updatedItem.imageUrl,
            isActive: updatedItem.isActive,
          });
        }
        setDialogMode("view");
        toast.success(t("updateSuccess"));
      } else {
        // Create new item
        if (!user?.companyId) {
          toast.error(t("missingCompany"));
          return;
        }

        const result = await createItem.mutateAsync({
          ...payload,
          companyId: user.companyId,
        });

        const itemId = result?.data?.id;

        if (itemId) {
          setCreatedItemId(itemId);
          toast.success(t("createSuccess"), {
            description: t("createSuccessDescription"),
          });
          // Switch to prices tab to continue adding details
          setActiveTab("prices");
        }
      }
    } catch {
      toast.error(resolvedItem ? t("updateError") : t("createError"));
    }
  };

  const handleClose = () => {
    form.reset();
    setCreatedItemId(null);
    setIsEditingExisting(false);
    setActiveTab("general");
    onOpenChange(false);
  };

  // Determine if we're in "view mode with tabs" (item exists or just created)
  const showTabs = isEditingExisting || createdItemId !== null;
  const currentItemId = resolvedItem?.id || createdItemId;
  const isReadOnly = dialogMode === "view";
  const watchedName = form.watch("name");
  const headerName = resolvedItem?.name || watchedName || "";
  const showHeaderName = activeTab !== "general" && !!headerName;

  if (itemId && itemLoading) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("loadingTitle")}</DialogTitle>
            <DialogDescription>{t("loadingDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-64 w-full animate-pulse rounded-md bg-muted" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (itemId && itemError) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t("errorLoadingTitle")}</DialogTitle>
            <DialogDescription>
              {itemError instanceof Error ? itemError.message : t("itemNotFound")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="flex h-[90vh] max-w-4xl flex-col overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {resolvedItem
              ? isReadOnly
                ? t("itemDetails")
                : t("editItem")
              : createdItemId
                ? t("addItemDetails")
                : t("createNewItem")}
            {showHeaderName ? ` - ${headerName}` : ""}
          </DialogTitle>
          <DialogDescription>
            {resolvedItem
              ? isReadOnly
                ? t("itemDetailsDescription")
                : t("editItemDescription")
              : createdItemId
                ? t("addItemDetailsDescription")
                : t("createNewItemDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showTabs ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">{t("generalTab")}</TabsTrigger>
                <TabsTrigger value="prices">{t("pricesTab")}</TabsTrigger>
                <TabsTrigger value="locations">{t("locationsTab")}</TabsTrigger>
              </TabsList>

              {/* General Tab */}
              <TabsContent value="general" className="mt-4 flex-1 overflow-y-auto pr-1">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div
                        className={`space-y-6 ${
                          isReadOnly
                            ? "pointer-events-none [&_input:disabled]:opacity-100 [&_input:disabled]:text-foreground [&_button:disabled]:opacity-100 [&_button:disabled]:text-foreground"
                            : ""
                        }`}
                      >
                      {/* Basic Information with Image */}
                      <div className="rounded-lg border bg-card">
                        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-semibold text-sm">{t("basicInformation")}</h4>
                        </div>

                        {/* Two Column Layout: Form Fields | Image Upload */}
                        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
                          {/* Left Column - Form Fields (2/3 width) */}
                          <div className="space-y-4 lg:col-span-2">
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("itemCodeLabel")}</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder={t("itemCodePlaceholder")}
                                        {...field}
                                        disabled={!!resolvedItem || !!createdItemId || isReadOnly}
                                        onChange={(event) =>
                                          field.onChange(event.target.value.toUpperCase())
                                        }
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="itemType"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("itemTypeLabel")}</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value}
                                      disabled={isReadOnly}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder={t("selectItemType")} />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {itemTypes.map((type) => (
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
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("itemNameLabel")}</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder={t("itemNamePlaceholder")}
                                      {...field}
                                      disabled={isReadOnly}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="chineseName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("chineseNameLabel")}</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder={t("chineseNamePlaceholder")}
                                      {...field}
                                      disabled={isReadOnly}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("descriptionLabel")}</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder={t("descriptionPlaceholder")}
                                      {...field}
                                      disabled={isReadOnly}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Right Column - Image Upload (1/3 width) */}
                          <div className="lg:col-span-1">
                            <FormField
                              control={form.control}
                              name="imageUrl"
                              render={({ field }) => (
                                <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  <ImageIcon className="h-3.5 w-3.5" />
                                  {t("itemImageLabel")}
                                </FormLabel>
                                  <FormControl>
                                    <ImageUpload
                                      value={field.value}
                                      onChange={field.onChange}
                                      itemId={currentItemId || undefined}
                                      disabled={isReadOnly}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {resolvedItem?.sku && resolvedItem?.skuQrImage ? (
                              <div className="mt-4 rounded-md border bg-muted/30 p-3">
                                <div className="flex flex-col items-center gap-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={resolvedItem.skuQrImage}
                                    alt={`SKU QR ${resolvedItem.sku}`}
                                    className="h-28 w-28 rounded border bg-white p-1"
                                  />
                                  <p className="font-mono text-sm font-semibold">{resolvedItem.sku}</p>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Classification & Unit */}
                      <div className="rounded-lg border bg-card">
                        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-semibold text-sm">{t("classificationAndUnit")}</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4 p-6">
                          <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("categoryLabel")}</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                  disabled={isReadOnly}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder={t("selectCategory")} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {categories.map((category) => (
                                      <SelectItem key={category.id} value={category.name}>
                                        {category.name}
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
                            name="uom"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("unitOfMeasureLabel")}</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                  disabled={isReadOnly}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder={t("selectUom")} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {unitsOfMeasure.map((uom) => (
                                      <SelectItem key={uom.id} value={uom.code}>
                                        {uom.name} ({uom.code})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Pricing */}
                      <div className="rounded-lg border bg-card">
                        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-semibold text-sm">{t("pricingInformation")}</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4 p-6">
                          <FormField
                            control={form.control}
                            name="standardCost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("standardCostLabel")}</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder={t("standardCostPlaceholder")}
                                    {...field}
                                    disabled={isReadOnly}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="listPrice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("listPriceLabel")}</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder={t("listPricePlaceholder")}
                                    {...field}
                                    disabled={isReadOnly}
                                    onChange={(e) =>
                                      field.onChange(parseFloat(e.target.value) || 0)
                                    }
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Inventory Management */}
                      <div className="rounded-lg border bg-card">
                        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-semibold text-sm">{t("inventoryManagement")}</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4 p-6">
                          <FormField
                            control={form.control}
                            name="reorderLevel"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("reorderLevelLabel")}</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder={t("reorderLevelPlaceholder")}
                                    {...field}
                                    disabled={isReadOnly}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormDescription>{t("reorderLevelDescription")}</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="reorderQty"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("reorderQtyLabel")}</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder={t("reorderQtyPlaceholder")}
                                    {...field}
                                    disabled={isReadOnly}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormDescription>{t("reorderQtyDescription")}</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                      </div>
                      </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                          {createdItemId ? t("close") : t("cancel")}
                        </Button>
                        {isReadOnly ? (
                          <Button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              setDialogMode("edit");
                            }}
                          >
                            {t("edit")}
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            disabled={createItem.isPending || updateItem.isPending}
                          >
                            {createItem.isPending || updateItem.isPending
                              ? t("saving")
                              : resolvedItem
                                ? t("updateItem")
                                : t("saveAndContinue")}
                          </Button>
                        )}
                    </DialogFooter>
                  </form>
                </Form>
              </TabsContent>

              {/* Prices Tab */}
              <TabsContent value="prices" className="mt-4 flex-1 overflow-y-auto pr-1">
                {currentItemId ? <PricesTab itemId={currentItemId} readOnly={isReadOnly} /> : null}
              </TabsContent>

              {/* Locations Tab */}
              <TabsContent value="locations" className="mt-4 flex-1 overflow-y-auto pr-1">
                  {currentItemId ? <LocationsTab itemId={currentItemId} /> : null}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="mt-4 flex min-h-0 flex-1 flex-col">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="flex-1 overflow-y-auto pr-1">
                  <div className="space-y-6 pb-6">
                    {/* Workflow Info Alert */}
                    <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                        {t("workflowInfo")}
                      </AlertDescription>
                    </Alert>

                    {/* Basic Information Card */}
                    <div className="rounded-lg border bg-card">
                      <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-semibold text-sm">{t("basicInformation")}</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
                        {/* Left Column - Form Fields */}
                        <div className="space-y-4 lg:col-span-2">
                    <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("itemCodeLabel")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("itemCodePlaceholder")}
                              {...field}
                              onChange={(event) =>
                                field.onChange(event.target.value.toUpperCase())
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="itemType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("itemTypeLabel")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("selectItemType")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {itemTypes.map((type) => (
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
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("itemNameLabel")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("itemNamePlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="chineseName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("chineseNameLabel")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("chineseNamePlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("descriptionLabel")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("descriptionPlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                        </div>

                        {/* Right Column - Image Upload */}
                        <div className="lg:col-span-1">
                          <FormField
                            control={form.control}
                            name="imageUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  <ImageIcon className="h-3.5 w-3.5" />
                                  {t("itemImageLabel")}
                                </FormLabel>
                                <FormControl>
                                  <ImageUpload
                                    value={field.value}
                                    onChange={field.onChange}
                                    itemId={currentItemId || undefined}
                                    disabled={false}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                  {/* Classification & Unit Card */}
                  <div className="rounded-lg border bg-card">
                    <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-sm">{t("classificationAndUnit")}</h4>
                    </div>
                    <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("categoryLabel")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("selectCategory")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.name}>
                                  {category.name}
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
                      name="uom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("unitOfMeasureLabel")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("selectUom")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {unitsOfMeasure.map((uom) => (
                                <SelectItem key={uom.id} value={uom.code}>
                                  {uom.name} ({uom.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                    </div>
                  </div>

                  {/* Pricing Information Card */}
                  <div className="rounded-lg border bg-card">
                    <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-sm">{t("pricingInformation")}</h4>
                    </div>
                    <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="standardCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("standardCostLabel")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={t("standardCostPlaceholder")}
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
                      name="listPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("listPriceLabel")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={t("listPricePlaceholder")}
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                    </div>
                  </div>

                  {/* Inventory Management Card */}
                  <div className="rounded-lg border bg-card">
                    <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-sm">{t("inventoryManagement")}</h4>
                    </div>
                    <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="reorderLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("reorderLevelLabel")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder={t("reorderLevelPlaceholder")}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>{t("reorderLevelDescription")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reorderQty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("reorderQtyLabel")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder={t("reorderQtyPlaceholder")}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>{t("reorderQtyDescription")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                    </div>
                  </div>

                  </div>
                </div>

                {/* Fixed Footer - Outside scroll container */}
                {isReadOnly ? (
                  <DialogFooter className="shrink-0 border-t bg-background pt-4">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      {t("close")}
                    </Button>
                  </DialogFooter>
                ) : (
                  <DialogFooter className="shrink-0 border-t bg-background pt-4">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      {t("cancel")}
                    </Button>
                    <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                      {createItem.isPending || updateItem.isPending
                        ? t("saving")
                        : t("saveAndContinue")}
                    </Button>
                  </DialogFooter>
                )}
                </form>
              </Form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
