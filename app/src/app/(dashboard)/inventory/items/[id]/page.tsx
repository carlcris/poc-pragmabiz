"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Package, DollarSign, Layers, TrendingUp, AlertTriangle, Edit } from "lucide-react";
import { useItem } from "@/hooks/useItems";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PackagingTab } from "@/components/items/packaging/PackagingTab";
import { PricesTab } from "@/components/items/prices/PricesTab";
import { LocationsTab } from "@/components/items/locations/LocationsTab";

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;
  const [activeTab, setActiveTab] = useState("general");


  const { data: item, isLoading, error } = useItem(itemId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p className="text-lg font-semibold">Error loading item</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : "Item not found"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Gradient Background */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-lg">
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
                  <Badge variant={item.isActive ? "outline" : "secondary"} className={item.isActive ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400" : ""}>
                    {item.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-blue-100">
                  <span className="font-mono font-semibold">{item.code}</span>
                  <span>•</span>
                  <span>{item.category || "No category"}</span>
                  <span>•</span>
                  <Badge variant="outline" className="border-white/30 text-white">
                    {item.itemType}
                  </Badge>
                </div>
              </div>
            </div>
            <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
              <Edit className="mr-2 h-4 w-4" />
              Edit Item
            </Button>
          </div>
        </div>
        {/* Decorative Elements */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      </div>

      {/* Quick Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Standard Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{item.standardCost != null ? item.standardCost.toFixed(2) : "0.00"}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">List Price</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{item.listPrice != null ? item.listPrice.toFixed(2) : "0.00"}</div>
            {item.standardCost != null && item.listPrice != null && item.standardCost > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Margin: {(((item.listPrice - item.standardCost) / item.standardCost) * 100).toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reorder Level</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.reorderLevel || "0"}</div>
            <p className="text-xs text-muted-foreground mt-1">Reorder Qty: {item.reorderQty || "0"}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Base UOM</CardTitle>
            <Package className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.uom || "N/A"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="gap-2">
            <Package className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="packaging" className="gap-2">
            <Package className="h-4 w-4" />
            Packaging
          </TabsTrigger>
          <TabsTrigger value="prices" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Prices
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-2">
            <Layers className="h-4 w-4" />
            Locations
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Core item details and identification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item Code</label>
                  <p className="text-lg font-mono font-semibold">{item.code}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item Name</label>
                  <p className="text-lg font-semibold">{item.name}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</label>
                  <Badge variant="outline" className="text-sm">
                    {item.category || "Uncategorized"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pricing Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium text-muted-foreground">Standard Cost</span>
                  <span className="text-lg font-bold">₱{item.standardCost != null ? item.standardCost.toFixed(2) : "0.00"}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 bg-green-50 dark:bg-green-950">
                  <span className="text-sm font-medium text-muted-foreground">List Price</span>
                  <span className="text-lg font-bold text-green-700 dark:text-green-400">₱{item.listPrice != null ? item.listPrice.toFixed(2) : "0.00"}</span>
                </div>
                {item.standardCost != null && item.listPrice != null && item.standardCost > 0 && (
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-blue-50 dark:bg-blue-950">
                    <span className="text-sm font-medium text-muted-foreground">Profit Margin</span>
                    <span className="text-lg font-bold text-blue-700 dark:text-blue-400">
                      {(((item.listPrice - item.standardCost) / item.standardCost) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inventory Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium text-muted-foreground">Base UOM</span>
                  <Badge className="text-sm">{item.uom || "N/A"}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium text-muted-foreground">Reorder Level</span>
                  <span className="text-lg font-bold">{item.reorderLevel || "0"}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium text-muted-foreground">Reorder Quantity</span>
                  <span className="text-lg font-bold">{item.reorderQty || "0"}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {item.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Packaging Tab */}
        <TabsContent value="packaging">
          <PackagingTab itemId={itemId} />
        </TabsContent>

        {/* Prices Tab */}
        <TabsContent value="prices">
          <PricesTab itemId={itemId} />
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations">
          <LocationsTab itemId={itemId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
