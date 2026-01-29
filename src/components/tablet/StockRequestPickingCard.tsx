"use client";

import Link from "next/link";
import { Calendar, MapPin, Package } from "lucide-react";
import { format } from "date-fns";
import type { StockRequest } from "@/types/stock-request";

type StockRequestPickingCardProps = {
  request: StockRequest;
};

const priorityStyles: Record<string, string> = {
  urgent: "text-red-700",
  high: "text-amber-700",
  normal: "text-slate-700",
  low: "text-slate-500",
};

export function StockRequestPickingCard({ request }: StockRequestPickingCardProps) {
  const fromLocation = request.from_location?.warehouse_name || "Unknown source";
  const toLocation = request.to_location?.warehouse_name || "Unknown destination";
  const itemCount = request.stock_request_items?.length || 0;
  const priorityClass = priorityStyles[request.priority] || "text-slate-700";

  return (
    <Link
      href={`/tablet/picking/${request.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow transition-shadow hover:shadow-md active:scale-[0.98]"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-gray-600" />
          <h3 className="font-bold text-gray-900">{request.request_code}</h3>
        </div>
        <span className={`text-xs font-semibold uppercase ${priorityClass}`}>
          {request.priority.replace("_", " ")}
        </span>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span>
            {toLocation} → {fromLocation}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>{format(new Date(request.required_date), "MMM d, yyyy")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          <span>
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </Link>
  );
}
