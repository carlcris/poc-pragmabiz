"use client";

import Link from "next/link";
import { Calendar, FileText, Package, MapPin, Truck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { LoadList } from "@/types/load-list";
import { Button } from "@/components/ui/button";

type LoadListReceivingCardProps = {
  loadList: LoadList;
  onMarkArrived?: (id: string) => void;
  isMarkingArrived?: boolean;
};

const statusColors: Record<string, string> = {
  in_transit: "bg-blue-100 text-blue-700",
  arrived: "bg-amber-100 text-amber-700",
  receiving: "bg-purple-100 text-purple-700",
  received: "bg-emerald-100 text-emerald-700",
};

export function LoadListReceivingCard({ loadList, onMarkArrived, isMarkingArrived }: LoadListReceivingCardProps) {
  const statusColor = statusColors[loadList.status] || "bg-gray-100 text-gray-700";

  const totalItems = loadList.items?.length || 0;
  const receivedItems = loadList.items?.filter((item) => (item.receivedQty || 0) > 0).length || 0;
  const progress = totalItems > 0 ? (receivedItems / totalItems) * 100 : 0;

  const handleMarkArrived = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onMarkArrived) {
      onMarkArrived(loadList.id);
    }
  };

  const CardContent = (
    <>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Truck className="h-5 w-5 text-gray-600" />
            <h3 className="font-bold text-gray-900">{loadList.llNumber}</h3>
          </div>
          <p className="text-sm text-gray-600">{loadList.supplier?.name || "--"}</p>
          {loadList.supplierLlNumber && (
            <p className="text-xs text-gray-500">Supplier LL#: {loadList.supplierLlNumber}</p>
          )}
        </div>

        <div className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusColor)}>
          {loadList.status.replace("_", " ").toUpperCase()}
        </div>
      </div>

      <div className="mb-3 space-y-2 text-sm">
        {loadList.estimatedArrivalDate && (
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>ETA: {format(new Date(loadList.estimatedArrivalDate), "MMM d, yyyy")}</span>
          </div>
        )}
        {loadList.actualArrivalDate && (
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>Arrived: {format(new Date(loadList.actualArrivalDate), "MMM d, yyyy")}</span>
          </div>
        )}
        {loadList.containerNumber && (
          <div className="flex items-center gap-2 text-gray-600">
            <Package className="h-4 w-4" />
            <span>Container: {loadList.containerNumber}</span>
          </div>
        )}
        {loadList.warehouse && (
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="h-4 w-4" />
            <span>{loadList.warehouse.name}</span>
          </div>
        )}
      </div>

      {totalItems > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Items</span>
            <span className="font-semibold text-gray-900">
              {receivedItems > 0 ? `${receivedItems} / ` : ""}{totalItems} items
            </span>
          </div>
          {receivedItems > 0 && (
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className={cn(
                  "h-2 rounded-full transition-all",
                  receivedItems === totalItems
                    ? "bg-emerald-500"
                    : receivedItems > 0
                      ? "bg-amber-500"
                      : "bg-gray-400"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {loadList.status === "in_transit" && onMarkArrived && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <Button
            onClick={handleMarkArrived}
            disabled={isMarkingArrived}
            size="sm"
            className="w-full"
          >
            {isMarkingArrived ? "Marking..." : "Mark as Arrived"}
          </Button>
        </div>
      )}
    </>
  );

  // If status is arrived or receiving, make it clickable to view GRN
  if (loadList.status === "arrived" || loadList.status === "receiving") {
    return (
      <Link
        href={`/tablet/receiving/${loadList.id}`}
        className="block rounded-lg border border-gray-200 bg-white p-4 shadow transition-shadow hover:shadow-md active:scale-[0.98]"
      >
        {CardContent}
      </Link>
    );
  }

  // Otherwise, just display the card
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
      {CardContent}
    </div>
  );
}
