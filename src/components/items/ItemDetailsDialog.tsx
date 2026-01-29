"use client";

import { Edit, Image as ImageIcon, Layers } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackagingTab } from "@/components/items/packaging/PackagingTab";
import { PricesTab } from "@/components/items/prices/PricesTab";
import { LocationsTab } from "@/components/items/locations/LocationsTab";
import { useItem } from "@/hooks/useItems";
import type { Item } from "@/types/item";

interface ItemDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  onEdit?: (item: Item) => void;
}

export function ItemDetailsDialog({ open, onOpenChange, itemId, onEdit }: ItemDetailsDialogProps) {
  const { data: response, isLoading, error } = useItem(itemId);
  const item = response?.data;

  const handleEdit = () => {
    if (item && onEdit) {
      onEdit(item);
      onOpenChange(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Item...</DialogTitle>
            <DialogDescription>Please wait while we load the item details...</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !item) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-destructive">Error Loading Item</DialogTitle>
            <DialogDescription>
              {error instanceof Error ? error.message : "Item not found"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>
            <span className="font-mono font-semibold">{item.code}</span>
            {item.category && (
              <>
                {" • "}
                <span>{item.category}</span>
              </>
            )}
            {item.uom && (
              <>
                {" • "}
                <span>{item.uom}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="packaging">Packaging</TabsTrigger>
            <TabsTrigger value="prices">Prices</TabsTrigger>
            <TabsTrigger value="locations" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Locations
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="mt-4 space-y-4">
            <div className="space-y-6">
              {/* Basic Information with Image */}
              <div>
                <h4 className="mb-4 text-sm font-medium">Basic Information</h4>

                {/* Two Column Layout: Form Fields | Image */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  {/* Left Column - Item Details (2/3 width) */}
                  <div className="lg:col-span-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Item Code</label>
                        <p className="font-mono text-base font-semibold">{item.code}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Item Name</label>
                        <p className="text-base font-semibold">{item.name}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Chinese Name</label>
                        <p className="text-base">{item.chineseName || "-"}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Category</label>
                        <p className="text-base">{item.category || "-"}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Item Type</label>
                        <p className="text-base capitalize">{item.itemType.replace(/_/g, " ")}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Base UOM</label>
                        <p className="text-base">{item.uom || "-"}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Status</label>
                        <Badge
                          variant={item.isActive ? "outline" : "secondary"}
                          className={
                            item.isActive
                              ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
                              : ""
                          }
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Image (1/3 width) */}
                  <div className="lg:col-span-1">
                    <label className="mb-2 block text-sm text-muted-foreground">Item Image</label>
                    {item.imageUrl ? (
                      <div className="relative h-[215px] w-full max-w-[250px] overflow-hidden rounded-lg border bg-muted">
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          className="object-contain p-2"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="flex h-[215px] w-full max-w-[250px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No image</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="border-t pt-4">
                <h4 className="mb-4 text-sm font-medium">Pricing Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Standard Cost</label>
                    <p className="text-lg font-bold">
                      ₱{item.standardCost != null ? item.standardCost.toFixed(2) : "0.00"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">List Price</label>
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">
                      ₱{item.listPrice != null ? item.listPrice.toFixed(2) : "0.00"}
                    </p>
                  </div>
                  {item.standardCost != null && item.listPrice != null && item.standardCost > 0 && (
                    <div className="col-span-2 space-y-2">
                      <label className="text-sm text-muted-foreground">Profit Margin</label>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                        {(((item.listPrice - item.standardCost) / item.standardCost) * 100).toFixed(
                          1
                        )}
                        %
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Inventory Management */}
              <div className="border-t pt-4">
                <h4 className="mb-4 text-sm font-medium">Inventory Management</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Reorder Level</label>
                    <p className="text-base font-semibold">{item.reorderLevel || "0"}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Reorder Quantity</label>
                    <p className="text-base font-semibold">{item.reorderQty || "0"}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {item.description && (
                <div className="border-t pt-4">
                  <h4 className="mb-4 text-sm font-medium">Description</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Packaging Tab */}
          <TabsContent value="packaging" className="mt-4">
            <PackagingTab itemId={itemId} />
          </TabsContent>

          {/* Prices Tab */}
          <TabsContent value="prices" className="mt-4">
            <PricesTab itemId={itemId} />
          </TabsContent>

          {/* Locations Tab */}
          <TabsContent value="locations" className="mt-4">
            <LocationsTab itemId={itemId} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEdit && (
            <Button onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Item
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
