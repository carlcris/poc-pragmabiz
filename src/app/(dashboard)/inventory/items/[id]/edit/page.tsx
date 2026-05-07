"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { AlertCircle, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useItem, useUpdateItem } from "@/hooks/useItems";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useUnitsOfMeasure } from "@/hooks/useUnitsOfMeasure";
import { createItemFormSchema } from "@/lib/validations/item";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { RESOURCES } from "@/constants/resources";
import { COMMON_IMPORT_CURRENCIES } from "@/constants/currencies";
import Link from "next/link";
import { ImageUpload } from "@/components/ui/image-upload";
import { ItemBarcodeImage } from "@/components/items/barcode/ItemBarcodeImage";

type EditItemPageProps = {
  params: Promise<{ id: string }>;
};

function EditItemContent({ params }: EditItemPageProps) {
  const router = useRouter();
  const unwrappedParams = React.use(params);
  const itemId = unwrappedParams.id;

  const t = useTranslations("inventoryItemPage");
  const tValidation = useTranslations("itemValidation");

  const { data: itemResponse, isLoading, error } = useItem(itemId);
  const updateItem = useUpdateItem();
  const { data: categoriesData } = useItemCategories();
  const { data: uomsData } = useUnitsOfMeasure();

  const item = itemResponse?.data;
  const canViewPricingDetails = itemResponse?.capabilities?.canViewPricingDetails === true;
  const isItemLoading = isLoading && !item;
  const hasLoadError = !isItemLoading && (Boolean(error) || !item);
  const primaryBarcode = item?.primaryBarcode ?? null;
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedUom, setSelectedUom] = useState("");
  const categories = useMemo(() => categoriesData?.data || [], [categoriesData?.data]);
  const unitsOfMeasure = useMemo(
    () => (uomsData?.data || []).filter((unit) => unit.isActive !== false),
    [uomsData?.data]
  );
  const categoryOptions = useMemo(() => {
    if (!item?.category) return categories;
    if (categories.some((category) => category.name === item.category)) return categories;
    return [{ id: `current-category-${itemId}`, name: item.category }, ...categories];
  }, [categories, item?.category, itemId]);
  const unitOptions = useMemo(() => {
    if (!item?.uom) return unitsOfMeasure;
    if (unitsOfMeasure.some((unit) => unit.code === item.uom)) return unitsOfMeasure;
    return [
      { id: item.uomId || `current-uom-${itemId}`, code: item.uom, name: item.uom },
      ...unitsOfMeasure,
    ];
  }, [item?.uom, item?.uomId, itemId, unitsOfMeasure]);
  const getUomLabel = (uomCode: string) => {
    const match = unitOptions.find((unit) => unit.code === uomCode);
    if (!match) return uomCode;
    return `${match.name} (${match.code})`;
  };

  const itemFormSchema = createItemFormSchema((key) => tValidation(key));
  type ItemFormInput = z.input<typeof itemFormSchema>;
  const itemTypes = useMemo(
    () =>
      [
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
      dimensions: {
        length: 0,
        width: 0,
        height: 0,
        unit: "",
      },
      itemType: "raw_material",
      uom: "",
      category: "",
      standardCost: 0,
      importCost: null,
      importCurrency: null,
      listPrice: 0,
      reorderLevel: 0,
      reorderQty: 0,
      imageUrl: undefined,
      isActive: true,
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        code: item.code,
        name: item.name,
        chineseName: item.chineseName || "",
        description: item.description || "",
        dimensions: {
          length: item.dimensions?.length ?? 0,
          width: item.dimensions?.width ?? 0,
          height: item.dimensions?.height ?? 0,
          unit: item.dimensions?.unit || "",
        },
        itemType: item.itemType,
        uom: item.uom,
        category: item.category,
        standardCost: item.standardCost ?? 0,
        importCost: item.importCost ?? null,
        importCurrency: item.importCurrency ?? null,
        listPrice: item.listPrice ?? 0,
        reorderLevel: item.reorderLevel,
        reorderQty: item.reorderQty,
        imageUrl: item.imageUrl,
        isActive: item.isActive,
      });
      setSelectedCategory(item.category || "");
      setSelectedUom(item.uom || "");
    }
  }, [item, form]);

  const onSubmit = async (values: ItemFormInput) => {
    try {
      const { code, standardCost, importCost, importCurrency, listPrice, ...updateData } = values;
      void code; // Code cannot be changed

      await updateItem.mutateAsync({
        id: itemId,
        data: {
          ...updateData,
          ...(canViewPricingDetails
            ? {
                standardCost: standardCost ?? 0,
                importCost: importCost ?? null,
                importCurrency: importCost == null ? null : importCurrency,
                listPrice: listPrice ?? 0,
              }
            : {}),
          description: updateData.description || "",
          dimensions: {
            length: updateData.dimensions?.length ?? 0,
            width: updateData.dimensions?.width ?? 0,
            height: updateData.dimensions?.height ?? 0,
            unit: updateData.dimensions?.unit || "",
          },
          reorderLevel: updateData.reorderLevel ?? 0,
          reorderQty: updateData.reorderQty ?? 0,
        },
      });
      toast.success(t("updateSuccess"));
      router.push(`/inventory/items/${itemId}`);
    } catch {
      toast.error(t("updateError"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t("editItem")}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {t("updatePageDescription")}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {isItemLoading ? (
          <>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-6">
                {Array.from({ length: 4 }, (_, sectionIndex) => (
                  <div key={sectionIndex} className="space-y-4">
                    <Skeleton className="h-5 w-36" />
                    <div className="grid grid-cols-2 gap-4">
                      {Array.from({ length: sectionIndex === 0 ? 4 : 2 }, (_, fieldIndex) => (
                        <div key={fieldIndex} className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <Skeleton className="h-16 w-full rounded-lg" />
                <div className="flex items-center gap-4 pt-4">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="aspect-square w-full rounded-lg" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-52" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[215px] w-full rounded-lg" />
                </CardContent>
              </Card>
            </div>
          </>
        ) : hasLoadError ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">{t("itemInformationTitle")}</CardTitle>
                <CardDescription className="text-sm">
                  {t("itemInformationEditDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyStatePanel
                  icon={AlertCircle}
                  title="Error loading item"
                  description={(error as Error)?.message || "Item not found"}
                  className="min-h-[360px]"
                />
                <div className="mt-4 flex justify-center">
                  <Button asChild>
                    <Link href="/inventory/items">Back to Items</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">{t("itemImageLabel")}</CardTitle>
                  <CardDescription className="text-sm">{t("itemImageDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed bg-muted/30">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <>
        {/* Left Column - Main Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">{t("itemInformationTitle")}</CardTitle>
            <CardDescription className="text-sm">
              {t("itemInformationEditDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">{t("basicInformation")}</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("itemCodeLabel")}</FormLabel>
                          <FormControl>
                            <Input {...field} disabled />
                          </FormControl>
                          <FormDescription>{t("itemCodeImmutableDescription")}</FormDescription>
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
                          <FormControl>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              onChange={(event) => field.onChange(event.target.value)}
                              value={field.value}
                            >
                              {itemTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </FormControl>
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
                          <Textarea
                            placeholder={t("descriptionPlaceholder")}
                            {...field}
                            value={field.value || ""}
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Dimensions */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">{t("dimensionsSectionTitle")}</h3>

                  <div className="grid grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="dimensions.length"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("lengthLabel")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={t("dimensionPlaceholder")}
                              {...field}
                              value={field.value ?? 0}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dimensions.width"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("widthLabel")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={t("dimensionPlaceholder")}
                              {...field}
                              value={field.value ?? 0}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dimensions.height"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("heightLabel")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={t("dimensionPlaceholder")}
                              {...field}
                              value={field.value ?? 0}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dimensions.unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("dimensionUnitLabel")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("dimensionUnitPlaceholder")}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                </div>

                {/* Classification and Unit */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">{t("classificationAndUnit")}</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("categoryLabel")}</FormLabel>
                          <FormControl>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              onChange={(event) => {
                                const value = event.target.value;
                                setSelectedCategory(value);
                                field.onChange(value);
                              }}
                              value={selectedCategory}
                            >
                              <option value="">{t("selectCategory")}</option>
                              {categoryOptions.map((category) => (
                                <option key={category.id} value={category.name}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </FormControl>
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
                          <FormControl>
                            <select
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              onChange={(event) => {
                                const value = event.target.value;
                                setSelectedUom(value);
                                field.onChange(value);
                              }}
                              value={selectedUom}
                            >
                              <option value="">{t("selectUom")}</option>
                              {unitOptions.map((uom) => (
                                <option key={uom.id} value={uom.code}>
                                  {getUomLabel(uom.code)}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                </div>

                {canViewPricingDetails && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">{t("pricingInformation")}</h3>

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

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="importCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("importCostLabel")}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder={t("importCostPlaceholder")}
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === "" ? null : parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </FormControl>
                            <FormDescription>{t("importCostDescription")}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="importCurrency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("importCurrencyLabel")}</FormLabel>
                            <FormControl>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                value={field.value ?? ""}
                                onChange={(event) => field.onChange(event.target.value || null)}
                              >
                                <option value="">{t("selectImportCurrency")}</option>
                                {COMMON_IMPORT_CURRENCIES.map((currency) => (
                                  <option key={currency} value={currency}>
                                    {currency}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Inventory Management */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">{t("inventoryManagement")}</h3>

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
                              onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
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
                              onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                            />
                          </FormControl>
                          <FormDescription>{t("reorderQtyDescription")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Status */}
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">{t("activeStatusLabel")}</FormLabel>
                        <FormDescription>{t("activeStatusDescription")}</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Actions */}
                <div className="flex items-center gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/inventory/items/${itemId}`)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button type="submit" disabled={updateItem.isPending}>
                    {updateItem.isPending ? t("saving") : t("updateItem")}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Right Column - Image & Barcode */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("itemImageLabel")}</CardTitle>
              <CardDescription className="text-sm">{t("itemImageDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <ImageUpload
                          value={field.value}
                          onChange={field.onChange}
                          itemId={itemId}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("barcodeLabel")}</CardTitle>
              <CardDescription className="text-sm">
                {t("barcodeGeneratedDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {primaryBarcode ? (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-white p-4">
                    <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 px-4">
                      <ItemBarcodeImage value={primaryBarcode} alt={`Barcode ${primaryBarcode}`} />
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    {t("primaryBarcodeDescription")}
                  </p>
                  <p className="rounded bg-muted px-3 py-2 text-center font-mono text-sm font-medium">
                    {primaryBarcode}
                  </p>
                </div>
              ) : (
                <div className="flex h-[215px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30">
                  <QrCode className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t("noBarcode")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function EditItemPage(props: EditItemPageProps) {
  return (
    <ProtectedRoute resource={RESOURCES.ITEMS}>
      <EditItemContent {...props} />
    </ProtectedRoute>
  );
}
