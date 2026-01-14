import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import type { LowStockItem, OutOfStockItem } from '@/types/warehouse-dashboard';

type InventoryHealthPanelProps = {
  lowStocks: LowStockItem[];
  outOfStocks: OutOfStockItem[];
  isLoading: boolean;
};

export const InventoryHealthPanel = ({
  lowStocks,
  outOfStocks,
  isLoading,
}: InventoryHealthPanelProps) => {
  const lowStockItems = lowStocks.slice(0, 5);
  const outOfStockItems = outOfStocks.slice(0, 5);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Low Stocks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Low Stocks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : lowStocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No low stock items
            </p>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <Link
                  key={item.item_id}
                  href={`/inventory/items/${item.item_id}`}
                  className="block p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.item_name}</p>
                      {item.location_code && (
                        <p className="text-xs text-muted-foreground">
                          Location: {item.location_code}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-semibold text-yellow-700">
                        {item.qty.toFixed(2)} {item.uom}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Reorder: {item.reorder_level.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
              <Link
                href="/inventory/items"
                className="block text-sm font-medium text-primary hover:underline"
              >
                View all inventory
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
            Out of Stocks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : outOfStocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No out of stock items
            </p>
          ) : (
            <div className="space-y-2">
              {outOfStockItems.map((item) => (
                <Link
                  key={item.item_id}
                  href={`/inventory/items/${item.item_id}`}
                  className="block p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.item_name}</p>
                      {item.location_code && (
                        <p className="text-xs text-muted-foreground">
                          Location: {item.location_code}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-semibold text-red-700">
                        {item.qty.toFixed(2)} {item.uom}
                      </p>
                      {item.last_moved_at && (
                        <p className="text-xs text-muted-foreground">
                          Last: {new Date(item.last_moved_at).toLocaleDateString()}
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
                View all inventory
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
