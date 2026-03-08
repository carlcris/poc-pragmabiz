"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { LowStockItem, OutOfStockItem } from "@/types/warehouse-dashboard";

type InventoryHealthPanelProps = {
  lowStocks: LowStockItem[];
  outOfStocks: OutOfStockItem[];
  isLoading: boolean;
  locale: string;
};

export const InventoryHealthPanel = ({
  lowStocks,
  outOfStocks,
  isLoading,
  locale,
}: InventoryHealthPanelProps) => {
  const t = useTranslations("warehouseDashboard");
  const lowStockItems = lowStocks.slice(0, 5);
  const outOfStockItems = outOfStocks.slice(0, 5);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Low Stocks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            {t("lowStocks")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : lowStocks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noLowStockItems")}</p>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <Link
                  key={item.item_id}
                  href={`/inventory/items/${item.item_id}`}
                  className="block rounded-lg p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.item_name}</p>
                      {item.location_code && (
                        <p className="text-xs text-muted-foreground">
                          {t("locationLabel")}: {item.location_code}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-sm font-semibold text-yellow-700">
                        {item.qty.toFixed(2)} {item.uom}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("reorderLabel")}: {item.reorder_level.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
              <Link
                href="/inventory/items"
                className="block text-sm font-medium text-primary hover:underline"
              >
                {t("viewAllInventory")}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Out of Stocks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-red-600" />
            {t("outOfStocks")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : outOfStocks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noOutOfStockItems")}</p>
          ) : (
            <div className="space-y-2">
              {outOfStockItems.map((item) => (
                <Link
                  key={item.item_id}
                  href={`/inventory/items/${item.item_id}`}
                  className="block rounded-lg p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.item_name}</p>
                      {item.location_code && (
                        <p className="text-xs text-muted-foreground">
                          {t("locationLabel")}: {item.location_code}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-sm font-semibold text-red-700">
                        {item.qty.toFixed(2)} {item.uom}
                      </p>
                      {item.last_moved_at && (
                        <p className="text-xs text-muted-foreground">
                          {t("lastLabel")}: {new Date(item.last_moved_at).toLocaleDateString(locale)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
              <Link
                href="/inventory/items"
                className="block text-sm font-medium text-primary hover:underline"
              >
                {t("viewAllInventory")}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
