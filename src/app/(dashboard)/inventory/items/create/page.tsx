"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCreateItem } from "@/hooks/useItems";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useUnitsOfMeasure } from "@/hooks/useUnitsOfMeasure";
import { useAuthStore } from "@/stores/authStore";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { RESOURCES } from "@/constants/resources";
import Link from "next/link";
import { ImageUpload } from "@/components/ui/image-upload";

function CreateItemContent() {
  const router = useRouter();
  const t = useTranslations("inventoryItemPage");
  const tValidation = useTranslations("itemValidation");
  const { user } = useAuthStore();

  const createItem = useCreateItem();
  const { data: categoriesData } = useItemCategories();
  const { data: uomsData } = useUnitsOfMeasure();

  const categories = useMemo(() => categoriesData?.data || [], [categoriesData?.data]);
  const unitsOfMeasure = useMemo(
    () => (uomsData?.data || []).filter((unit) => unit.isActive !== false),
    [uomsData?.data]
  );

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

  // Auto-select first UOM if available
  useEffect(() => {
    if (unitsOfMeasure.length === 0) return;
    const currentUom = form.getValues("uom");
    const hasMatch = unitsOfMeasure.some((unit) => unit.code === currentUom);
    if (!currentUom || !hasMatch) {
      form.setValue("uom", unitsOfMeasure[0].code);
    }
  }, [form, unitsOfMeasure]);

  // Auto-select first category if available
  useEffect(() => {
    if (categories.length === 0) return;
    const currentCategory = form.getValues("category");
    const hasMatch = categories.some((category) => category.name === currentCategory);
    if (!currentCategory || !hasMatch) {
      form.setValue("category", categories[0].name);
    }
  }, [categories, form]);

  const onSubmit = async (values: ItemFormInput) => {
    try {
      if (!user?.companyId) {
        toast.error(t("missingCompany"));
        return;
      }

      const created = await createItem.mutateAsync({
        ...values,
        description: values.description || "",
        standardCost: values.standardCost ?? 0,
        reorderLevel: values.reorderLevel ?? 0,
        reorderQty: values.reorderQty ?? 0,
        isActive: values.isActive ?? true,
        companyId: user.companyId,
      });

      toast.success(t("createSuccess"), {
        description: t("createSuccessDescription"),
      });
      router.push(`/inventory/items/${created.data.id}`);
    } catch {
      toast.error(t("createError"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inventory/items">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t("createNewItem")}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {t("createPageDescription")}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">{t("itemInformationTitle")}</CardTitle>
            <CardDescription className="text-sm">{t("itemInformationCreateDescription")}</CardDescription>
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
                            <Input
                              placeholder={t("itemCodePlaceholder")}
                              {...field}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            />
                          </FormControl>
                          <FormDescription>
                            {t("itemCodeAutoGenerateDescription")}
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
                    onClick={() => router.push("/inventory/items")}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={createItem.isPending}
                  >
                    {createItem.isPending ? t("saving") : t("createNewItem")}
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
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function CreateItemPage() {
  return (
    <ProtectedRoute resource={RESOURCES.ITEMS}>
      <CreateItemContent />
    </ProtectedRoute>
  );
}
