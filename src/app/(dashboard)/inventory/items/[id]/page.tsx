"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Package,
  Pencil,
  Hash,
  FileText,
  Tag,
  ImageIcon,
  QrCode,
  Lock,
  Warehouse,
  Truck,
  Ruler,
  Layers,
} from "lucide-react";
import { useItem } from "@/hooks/useItems";
import { useCanEdit } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PricesTab } from "@/components/items/prices/PricesTab";
import { LocationsTab } from "@/components/items/locations/LocationsTab";
import { ItemLedgerTab } from "@/components/items/ledger/ItemLedgerTab";
import { ItemBarcodeImage } from "@/components/items/barcode/ItemBarcodeImage";
import { ItemImage } from "@/components/items/ItemImage";
import { ItemUnitOptionsCard } from "@/components/items/unit-options/ItemUnitOptionsCard";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { MetricCard } from "@/components/shared/MetricCard";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { EditGuard } from "@/components/permissions/PermissionGuard";
import { RESOURCES } from "@/constants/resources";

type ItemDetailsPageProps = {
  params: Promise<{ id: string }>;
};

function ItemDetailsContent({ params }: ItemDetailsPageProps) {
  const t = useTranslations("inventoryItemPage");
  const searchParams = useSearchParams();
  const unwrappedParams = React.use(params);
  const itemId = unwrappedParams.id;
  const [activeTab, setActiveTab] = useState("overview");
  const canEditItems = useCanEdit(RESOURCES.ITEMS);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const { data: itemResponse, isLoading, error } = useItem(itemId);
  const item = itemResponse?.data;
  const canViewPricingDetails = itemResponse?.capabilities?.canViewPricingDetails === true;

  useEffect(() => {
    if (!isLoading && !canViewPricingDetails && activeTab === "prices") {
      setActiveTab("overview");
    }
  }, [activeTab, canViewPricingDetails, isLoading]);

  const tabPanelClassName = "mt-4 min-h-[52rem] space-y-4";
  const isItemLoading = isLoading && !item;
  const itemTypeLabel = item?.itemType
    ? item.itemType
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : null;
  const formatQuantity = (value: number | undefined) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value ?? 0);
  const formatImportCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(amount);

  if (error || !item) {
    if (isItemLoading) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-10 w-28" />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard title={t("availableQtyLabel")} icon={Package} isLoading />
            <MetricCard title={t("reservedQtyLabel")} icon={Lock} isLoading />
            <MetricCard title={t("onHandLabel")} icon={Warehouse} isLoading />
            <MetricCard title={t("inTransitLabel")} icon={Truck} isLoading />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">{t("overviewTab")}</TabsTrigger>
              <TabsTrigger value="unitOptions">{t("unitOptionsTab")}</TabsTrigger>
              <TabsTrigger value="ledger">{t("ledgerTab")}</TabsTrigger>
              <TabsTrigger value="locations">{t("locationsTab")}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className={tabPanelClassName}>
              <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-56" />
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[1, 2, 3, 4].map((field) => (
                        <div key={field} className="flex items-start gap-3">
                          <Skeleton className="h-9 w-9 rounded-lg" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-5 w-40" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-3 border-t pt-4">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-5 w-64" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>
                    <div className="flex items-start gap-3 border-t pt-4">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-11/12" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {[1, 2].map((panel) => (
                    <Card key={panel}>
                      <CardHeader className="pb-3">
                        <Skeleton className="h-5 w-28" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-[240px] w-full rounded-lg" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map((panel) => (
                  <Card key={panel}>
                    <CardHeader>
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="h-4 w-52" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[1, 2, 3].map((row) => (
                        <div key={row} className="flex items-center justify-between">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-6 w-20" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="unitOptions" className={tabPanelClassName}>
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="mt-2 h-4 w-72" />
                  </div>
                  <Skeleton className="h-10 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  {[1, 2].map((row) => (
                    <Skeleton key={row} className="h-16 w-full" />
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ledger" className={tabPanelClassName}>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    {[1, 2, 3, 4].map((filter) => (
                      <Skeleton key={filter} className="h-10 w-full" />
                    ))}
                  </div>
                  <Skeleton className="h-40 w-full" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="locations" className={tabPanelClassName}>
              <LocationsTab itemId={itemId} />
            </TabsContent>
          </Tabs>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              {t("errorLoadingTitle")}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t("itemNotFound")}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/inventory/items">{t("backToItems")}</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title={t("availableQtyLabel")} icon={Package} value="--" />
          <MetricCard title={t("reservedQtyLabel")} icon={Lock} value="--" />
          <MetricCard title={t("onHandLabel")} icon={Warehouse} value="--" />
          <MetricCard title={t("inTransitLabel")} icon={Truck} value="--" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">{t("overviewTab")}</TabsTrigger>
            <TabsTrigger value="unitOptions">{t("unitOptionsTab")}</TabsTrigger>
            <TabsTrigger value="ledger">{t("ledgerTab")}</TabsTrigger>
            <TabsTrigger value="locations">{t("locationsTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className={tabPanelClassName}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {t("itemInformationTitle")}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t("itemInformationDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyStatePanel
                  icon={Package}
                  title={t("errorLoadingTitle")}
                  description={(error as Error)?.message || t("itemNotFound")}
                  className="min-h-[320px]"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{item.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {item.code} • {item.category || t("noCategory")} • {itemTypeLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EditGuard resource={RESOURCES.ITEMS}>
            <Button asChild>
              <Link href={`/inventory/items/${itemId}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                {t("editItemAction")}
              </Link>
            </Button>
          </EditGuard>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title={t("availableQtyLabel")}
          icon={Package}
          value={formatQuantity(item.available)}
        />
        <MetricCard
          title={t("reservedQtyLabel")}
          icon={Lock}
          value={formatQuantity(item.allocated)}
        />
        <MetricCard title={t("onHandLabel")} icon={Warehouse} value={formatQuantity(item.onHand)} />
        <MetricCard
          title={t("inTransitLabel")}
          icon={Truck}
          value={formatQuantity(item.inTransit)}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b border-border/40 bg-gradient-to-r from-background via-muted/20 to-background">
          <div className="container-fluid">
            <TabsList className="h-auto w-full justify-start gap-2 rounded-none border-b-0 bg-transparent p-0 py-2">
              <TabsTrigger
                value="overview"
                className="group relative gap-2 rounded-full border border-border/40 bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-purple-300 hover:bg-muted/50 hover:text-foreground data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30"
              >
                <Package className="h-4 w-4" />
                {t("overviewTab")}
              </TabsTrigger>
              {canViewPricingDetails && (
                <TabsTrigger
                  value="prices"
                  className="group relative gap-2 rounded-full border border-border/40 bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-purple-300 hover:bg-muted/50 hover:text-foreground data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30"
                >
                  <Tag className="h-4 w-4" />
                  {t("pricesTab")}
                </TabsTrigger>
              )}
              <TabsTrigger
                value="unitOptions"
                className="group relative gap-2 rounded-full border border-border/40 bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-purple-300 hover:bg-muted/50 hover:text-foreground data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30"
              >
                <Ruler className="h-4 w-4" />
                {t("unitOptionsTab")}
              </TabsTrigger>
              <TabsTrigger
                value="ledger"
                className="group relative gap-2 rounded-full border border-border/40 bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-purple-300 hover:bg-muted/50 hover:text-foreground data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30"
              >
                <FileText className="h-4 w-4" />
                {t("ledgerTab")}
              </TabsTrigger>
              <TabsTrigger
                value="locations"
                className="group relative gap-2 rounded-full border border-border/40 bg-transparent px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:border-purple-300 hover:bg-muted/50 hover:text-foreground data-[state=active]:border-purple-500 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30"
              >
                <Warehouse className="h-4 w-4" />
                {t("locationsTab")}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className={tabPanelClassName}>
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            {/* Main Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {t("itemInformationTitle")}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t("itemInformationDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Details Grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-muted p-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("itemCodeLabel")}
                      </p>
                      <p className="font-mono font-medium">{item.code}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-muted p-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("categoryLabel")}
                      </p>
                      <p className="font-medium">{item.category || t("uncategorized")}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-muted p-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("itemTypeLabel")}
                      </p>
                      <Badge variant="outline">{itemTypeLabel}</Badge>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-muted p-2">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("unitOfMeasureLabel")}
                      </p>
                      <p className="font-medium">{item.uom}</p>
                    </div>
                  </div>
                </div>

                {/* Full Width Item Name */}
                <div className="flex items-start gap-3 border-t pt-4">
                  <div className="mt-0.5 rounded-lg bg-muted p-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("itemNameLabel")}
                    </p>
                    <p className="font-medium">{item.name}</p>
                    {item.chineseName && (
                      <p className="text-sm text-muted-foreground">{item.chineseName}</p>
                    )}
                  </div>
                </div>

                {/* Description */}
                {item.description && (
                  <div className="flex items-start gap-3 border-t pt-4">
                    <div className="mt-0.5 rounded-lg bg-muted p-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("descriptionLabel")}
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Image and QR Code Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <ImageIcon className="h-4 w-4" />
                    {t("itemImageLabel")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative h-[240px] w-full overflow-hidden rounded-lg border bg-white">
                    <ItemImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="object-contain p-3"
                      sizes="(min-width: 1024px) 320px, 100vw"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <QrCode className="h-4 w-4" />
                    {t("barcodeLabel")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {item.primaryBarcode ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border bg-white p-4">
                        <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 px-4">
                          <ItemBarcodeImage
                            value={item.primaryBarcode}
                            alt={`Barcode ${item.primaryBarcode}`}
                          />
                        </div>
                      </div>
                      <p className="text-center text-sm text-muted-foreground">
                        {t("primaryBarcodeDescription")}
                      </p>
                      <p className="rounded bg-muted px-3 py-2 text-center font-mono text-sm font-medium">
                        {item.primaryBarcode}
                      </p>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-center rounded-lg border border-dashed bg-muted/30"
                      style={{ height: "240px" }}
                    >
                      <div className="text-center text-muted-foreground">
                        <QrCode className="mx-auto mb-2 h-8 w-8" />
                        <p className="text-sm">{t("noBarcode")}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Pricing and Inventory Summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {t("dimensionsSectionTitle")}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t("dimensionsSectionDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("lengthLabel")}
                  </span>
                  <span className="text-lg font-bold">{item.dimensions?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("widthLabel")}
                  </span>
                  <span className="text-lg font-bold">{item.dimensions?.width ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("heightLabel")}
                  </span>
                  <span className="text-lg font-bold">{item.dimensions?.height ?? 0}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("dimensionUnitLabel")}
                  </span>
                  <span className="text-lg font-bold">{item.dimensions?.unit || "-"}</span>
                </div>
              </CardContent>
            </Card>

            {canViewPricingDetails && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    {t("pricingDetailsTitle")}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t("pricingDetailsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {t("standardCostLabel")}
                    </span>
                    <span className="text-lg font-bold">
                      ₱{item.standardCost != null ? item.standardCost.toFixed(2) : "0.00"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {t("listPriceLabel")}
                    </span>
                    <span className="text-lg font-bold">
                      ₱{item.listPrice != null ? item.listPrice.toFixed(2) : "0.00"}
                    </span>
                  </div>
                  {item.importCost != null && item.importCurrency ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        {t("importCostLabel")}
                      </span>
                      <span className="text-lg font-bold">
                        {formatImportCurrency(item.importCost, item.importCurrency)}
                      </span>
                    </div>
                  ) : null}
                  {item.standardCost != null && item.listPrice != null && item.standardCost > 0 && (
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        {t("profitMarginLabel")}
                      </span>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-500">
                        {(((item.listPrice - item.standardCost) / item.standardCost) * 100).toFixed(
                          1
                        )}
                        %
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {t("inventoryManagement")}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t("reorderSettingsDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("reorderLevelLabel")}
                  </span>
                  <span className="text-lg font-bold">{item.reorderLevel || "0"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("reorderQtyLabel")}
                  </span>
                  <span className="text-lg font-bold">{item.reorderQty || "0"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("maxStockLevelLabel")}
                  </span>
                  <span className="text-lg font-bold">{item.maxStockLevel || "0"}</span>
                </div>
                {item.inTransit !== undefined && item.inTransit > 0 && (
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {t("inTransitLabel")}
                    </span>
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-500">
                      {item.inTransit}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {canViewPricingDetails && (
          <TabsContent value="prices" className={tabPanelClassName}>
            <PricesTab itemId={itemId} />
          </TabsContent>
        )}

        {/* Unit Options Tab */}
        <TabsContent value="unitOptions" className={tabPanelClassName}>
          <ItemUnitOptionsCard itemId={itemId} baseUomCode={item.uom} editable={canEditItems} />
        </TabsContent>

        {/* Ledger Tab */}
        <TabsContent value="ledger" className={tabPanelClassName}>
          <ItemLedgerTab itemId={itemId} itemUom={item.uom} />
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations" className={tabPanelClassName}>
          <LocationsTab itemId={itemId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ItemDetailPage(props: ItemDetailsPageProps) {
  return (
    <ProtectedRoute resource={RESOURCES.ITEMS}>
      <ItemDetailsContent {...props} />
    </ProtectedRoute>
  );
}
