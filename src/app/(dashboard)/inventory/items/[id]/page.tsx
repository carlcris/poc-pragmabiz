"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PricesTab } from "@/components/items/prices/PricesTab";
import { LocationsTab } from "@/components/items/locations/LocationsTab";
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

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const { data: itemResponse, isLoading, error } = useItem(itemId);
  const item = itemResponse?.data;
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
            {[1, 2, 3, 4].map((card) => (
              <Card key={card}>
                <CardHeader className="space-y-2 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">{t("overviewTab")}</TabsTrigger>
              <TabsTrigger value="prices">{t("pricesTab")}</TabsTrigger>
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

            <TabsContent value="prices" className={tabPanelClassName}>
              <PricesTab itemId={itemId} />
            </TabsContent>

            <TabsContent value="locations" className={tabPanelClassName}>
              <LocationsTab itemId={itemId} />
            </TabsContent>
          </Tabs>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-2">{t("errorLoadingTitle")}</p>
          <p className="text-sm text-gray-500">{(error as Error)?.message || t("itemNotFound")}</p>
          <Button asChild className="mt-4">
            <Link href="/inventory/items">{t("backToItems")}</Link>
          </Button>
        </div>
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
                <Pencil className="h-4 w-4 mr-2" />
                {t("editItemAction")}
              </Link>
            </Button>
          </EditGuard>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("availableQtyLabel")}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatQuantity(item.available)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("reservedQtyLabel")}</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatQuantity(item.allocated)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("onHandLabel")}</CardTitle>
            <Warehouse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatQuantity(item.onHand)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("inTransitLabel")}</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatQuantity(item.inTransit)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t("overviewTab")}</TabsTrigger>
          <TabsTrigger value="prices">{t("pricesTab")}</TabsTrigger>
          <TabsTrigger value="locations">{t("locationsTab")}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className={tabPanelClassName}>
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            {/* Main Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">{t("itemInformationTitle")}</CardTitle>
                <CardDescription className="text-sm">{t("itemInformationDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Details Grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-muted p-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t("itemCodeLabel")}</p>
                      <p className="font-medium font-mono">{item.code}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-muted p-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t("categoryLabel")}</p>
                      <p className="font-medium">{item.category || t("uncategorized")}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-muted p-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t("itemTypeLabel")}</p>
                      <Badge variant="outline">
                        {itemTypeLabel}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-muted p-2">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t("unitOfMeasureLabel")}</p>
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
                    <p className="text-xs font-medium text-muted-foreground">{t("itemNameLabel")}</p>
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
                      <p className="text-xs font-medium text-muted-foreground">{t("descriptionLabel")}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Image and QR Code Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    {t("itemImageLabel")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {item.imageUrl ? (
                    <div className="relative h-[240px] w-full overflow-hidden rounded-lg border bg-white">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-contain p-3"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/30" style={{ height: '240px' }}>
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="mx-auto mb-2 h-8 w-8" />
                        <p className="text-sm">{t("noImage")}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    {t("qrCodeLabel")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {item.skuQrImage ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border bg-white p-4">
                        <div className="relative mx-auto h-[200px] w-[200px]">
                          <Image
                            src={item.skuQrImage}
                            alt={`SKU QR ${item.sku || item.code}`}
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      </div>
                      <p className="text-center text-sm font-mono font-medium bg-muted px-3 py-2 rounded">
                        {item.sku || item.code}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/30" style={{ height: '240px' }}>
                      <div className="text-center text-muted-foreground">
                        <QrCode className="mx-auto mb-2 h-8 w-8" />
                        <p className="text-sm">{t("noQrCode")}</p>
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
                <CardTitle className="text-base font-semibold">{t("pricingDetailsTitle")}</CardTitle>
                <CardDescription className="text-sm">{t("pricingDetailsDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{t("standardCostLabel")}</span>
                  <span className="text-lg font-bold">
                    ₱{item.standardCost != null ? item.standardCost.toFixed(2) : "0.00"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{t("listPriceLabel")}</span>
                  <span className="text-lg font-bold">
                    ₱{item.listPrice != null ? item.listPrice.toFixed(2) : "0.00"}
                  </span>
                </div>
                {item.standardCost != null && item.listPrice != null && item.standardCost > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium text-muted-foreground">{t("profitMarginLabel")}</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-500">
                      {(((item.listPrice - item.standardCost) / item.standardCost) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">{t("inventoryManagement")}</CardTitle>
                <CardDescription className="text-sm">{t("reorderSettingsDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{t("reorderLevelLabel")}</span>
                  <span className="text-lg font-bold">{item.reorderLevel || "0"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{t("reorderQtyLabel")}</span>
                  <span className="text-lg font-bold">{item.reorderQty || "0"}</span>
                </div>
                {item.inTransit !== undefined && item.inTransit > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium text-muted-foreground">{t("inTransitLabel")}</span>
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-500">
                      {item.inTransit}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Prices Tab */}
        <TabsContent value="prices" className={tabPanelClassName}>
          <PricesTab itemId={itemId} />
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
