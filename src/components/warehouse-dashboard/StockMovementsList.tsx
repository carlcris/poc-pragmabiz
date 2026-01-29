import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowDown, ArrowUp, ArrowLeftRight, Settings } from "lucide-react";
import type { StockMovementItem } from "@/types/warehouse-dashboard";

type StockMovementsListProps = {
  movements: StockMovementItem[];
  isLoading: boolean;
};

export const StockMovementsList = ({ movements, isLoading }: StockMovementsListProps) => {
  const getMovementIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes("in") || lowerType.includes("receive")) {
      return <ArrowDown className="h-4 w-4 text-green-600" />;
    }
    if (lowerType.includes("out") || lowerType.includes("issue")) {
      return <ArrowUp className="h-4 w-4 text-red-600" />;
    }
    if (lowerType.includes("transfer")) {
      return <ArrowLeftRight className="h-4 w-4 text-blue-600" />;
    }
    if (lowerType.includes("adj")) {
      return <Settings className="h-4 w-4 text-orange-600" />;
    }
    return <Package className="h-4 w-4 text-gray-600" />;
  };

  const getMovementBadgeClass = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes("in") || lowerType.includes("receive")) {
      return "bg-green-100 text-green-800 border-green-300";
    }
    if (lowerType.includes("out") || lowerType.includes("issue")) {
      return "bg-red-100 text-red-800 border-red-300";
    }
    if (lowerType.includes("transfer")) {
      return "bg-blue-100 text-blue-800 border-blue-300";
    }
    if (lowerType.includes("adj")) {
      return "bg-orange-100 text-orange-800 border-orange-300";
    }
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Last 5 Stock Movements
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : movements.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No recent stock movements
          </p>
        ) : (
          <div className="space-y-3">
            {movements.map((movement, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex-shrink-0">{getMovementIcon(movement.type)}</div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="outline" className={getMovementBadgeClass(movement.type)}>
                      {movement.type}
                    </Badge>
                    <p className="truncate text-sm font-medium">{movement.item_name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    by {movement.performed_by} • {formatTime(movement.timestamp)}
                  </p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold">
                    {movement.qty > 0 ? "+" : ""}
                    {movement.qty.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{movement.uom}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
