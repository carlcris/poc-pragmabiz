"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, QrCode } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { RESOURCES } from "@/constants/resources";
import Link from "next/link";
import { ImageUpload } from "@/components/ui/image-upload";

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
    return [{ id: item.uomId || `current-uom-${itemId}`, code: item.uom, name: item.uom }, ...unitsOfMeasure];
  }, [item?.uom, item?.uomId, itemId, unitsOfMeasure]);
  const getUomLabel = (uomCode: string) => {
    const match = unitOptions.find((unit) => unit.code === uomCode);
    if (!match) return uomCode;
    return `${match.name} (${match.code})`;
  };

  const itemFormSchema = createItemFormSchema((key) => tValidation(key));
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
        itemType: item.itemType,
        uom: item.uom,
        category: item.category,
        standardCost: item.standardCost,
        listPrice: item.listPrice,
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
      const { code, ...updateData } = values;
      void code; // Code cannot be changed

      await updateItem.mutateAsync({
        id: itemId,
        data: {
          ...updateData,
          description: updateData.description || "",
          standardCost: updateData.standardCost ?? 0,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading item</p>
          <p className="text-sm text-gray-500">{(error as Error)?.message || "Item not found"}</p>
          <Button asChild className="mt-4">
            <Link href="/inventory/items">Back to Items</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/inventory/items/${itemId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t("editItem")}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {t("updatePageDescription")}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">{t("itemInformationTitle")}</CardTitle>
            <CardDescription className="text-sm">{t("itemInformationEditDescription")}</CardDescription>
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
                          <FormDescription>
                            {t("itemCodeImmutableDescription")}
                          </FormDescription>
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

                {/* Pricing */}
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
                </div>

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
                        <FormDescription>
                          {t("activeStatusDescription")}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
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
                  <Button
                    type="submit"
                    disabled={updateItem.isPending}
                  >
                    {updateItem.isPending ? t("saving") : t("updateItem")}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Image Upload Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("itemImageLabel")}</CardTitle>
              <CardDescription className="text-sm">
                {t("itemImageDescription")}
              </CardDescription>
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
                          itemId={item.id}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Form>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t("qrCodeLabel")}</CardTitle>
              <CardDescription className="text-sm">
                {t("qrCodeReadonlyDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {item.skuQrImage ? (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.skuQrImage}
                      alt={`SKU QR ${item.sku || item.code}`}
                      className="mx-auto h-[200px] w-[200px] object-contain"
                    />
                  </div>
                  <p className="rounded bg-muted px-3 py-2 text-center font-mono text-sm font-medium">
                    {item.sku || item.code}
                  </p>
                </div>
              ) : (
                <div className="flex h-[215px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30">
                  <QrCode className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t("noQrCodeAvailable")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
