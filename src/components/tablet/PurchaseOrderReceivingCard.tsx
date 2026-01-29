"use client";

import Link from "next/link";
import { Calendar, FileText, Package } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { PurchaseOrder } from "@/types/purchase-order";

type PurchaseOrderReceivingCardProps = {
  order: PurchaseOrder;
};

const statusColors: Record<string, string> = {
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  in_transit: "bg-amber-100 text-amber-700 border-amber-200",
  partially_received: "bg-purple-100 text-purple-700 border-purple-200",
  received: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export function PurchaseOrderReceivingCard({ order }: PurchaseOrderReceivingCardProps) {
  const statusColor = statusColors[order.status] || "bg-gray-100 text-gray-700 border-gray-200";

  const totalItems = order.items?.length || 0;
  const receivedItems = order.items?.filter((item) => (item.quantityReceived || 0) > 0).length || 0;
  const progress = totalItems > 0 ? (receivedItems / totalItems) * 100 : 0;

  return (
    <Link
      href={`/tablet/receiving/${order.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow transition-shadow hover:shadow-md active:scale-[0.98]"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-600" />
            <h3 className="font-bold text-gray-900">{order.orderCode}</h3>
          </div>
          <p className="text-sm text-gray-600">{order.supplier?.name || "--"}</p>
        </div>

        <div className={cn("rounded-full border px-3 py-1 text-xs font-semibold", statusColor)}>
          {order.status.replace("_", " ").toUpperCase()}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>{format(new Date(order.expectedDeliveryDate), "MMM d, yyyy")}</span>
        </div>
        <div className="col-span-2 flex items-center gap-2 text-gray-600">
          <FileText className="h-4 w-4" />
          <span>Order Date: {format(new Date(order.orderDate), "MMM d, yyyy")}</span>
        </div>
      </div>

      {totalItems > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-semibold text-gray-900">
              {receivedItems} / {totalItems} items
            </span>
          </div>
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
        </div>
      )}
    </Link>
  );
}
