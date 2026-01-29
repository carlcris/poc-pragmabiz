"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Package } from "lucide-react";

type MobileItem = {
  itemId: string;
  itemCode: string;
  itemName: string;
  unitPrice: number;
  availableStock: number;
  uomName: string;
  categoryName?: string;
};

type MobileItemCardProps = {
  item: MobileItem;
  onAddToCart: (item: MobileItem) => void;
  inCart?: boolean;
};

export function MobileItemCard({ item, onAddToCart, inCart }: MobileItemCardProps) {
  const hasStock = item.availableStock > 0;
  const isOutOfStock = item.availableStock === 0;

  return (
    <Card className={`shadow-sm ${isOutOfStock ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
            <Package className="h-6 w-6 text-gray-400" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="line-clamp-1 text-sm font-medium">{item.itemName}</h3>
                <p className="mt-0.5 text-xs text-gray-500">{item.itemCode}</p>
              </div>
              {inCart && (
                <Badge variant="secondary" className="text-xs">
                  In Cart
                </Badge>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-blue-600">₱{item.unitPrice.toFixed(2)}</p>
                <p className="text-xs text-gray-500">
                  {hasStock ? (
                    <>
                      <span className="font-medium">{item.availableStock}</span> {item.uomName}{" "}
                      available
                    </>
                  ) : (
                    <span className="font-medium text-red-500">Out of Stock</span>
                  )}
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => onAddToCart(item)}
                disabled={isOutOfStock || inCart}
                className="h-9 px-4"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
