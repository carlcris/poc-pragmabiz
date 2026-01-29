"use client";

import Link from "next/link";
import { Package, Calendar, Building2, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { TabletReceiptSummary } from "@/hooks/tablet/useTabletReceiving";

type ReceivingCardProps = {
  receipt: TabletReceiptSummary;
};

export function ReceivingCard({ receipt }: ReceivingCardProps) {
  const statusColors = {
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    received: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };

  const statusColor =
    statusColors[receipt.status as keyof typeof statusColors] || statusColors.draft;

  const { summary } = receipt;
  const progress = summary.totalItems > 0 ? (summary.receivedItems / summary.totalItems) * 100 : 0;

  return (
    <Link
      href={`/tablet/receiving/${receipt.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow transition-shadow hover:shadow-md active:scale-[0.98]"
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Package className="h-5 w-5 text-gray-600" />
            <h3 className="font-bold text-gray-900">{receipt.receiptCode}</h3>
          </div>
          <p className="text-sm text-gray-600">{receipt.supplier.name}</p>
        </div>

        {/* Status Badge */}
        <div className={cn("rounded-full border px-3 py-1 text-xs font-semibold", statusColor)}>
          {receipt.status.toUpperCase()}
        </div>
      </div>

      {/* Info Grid */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>{format(new Date(receipt.receiptDate), "MMM d, yyyy")}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Building2 className="h-4 w-4" />
          <span className="truncate">{receipt.warehouse.name}</span>
        </div>
        <div className="col-span-2 flex items-center gap-2 text-gray-600">
          <FileText className="h-4 w-4" />
          <span>PO: {receipt.purchaseOrder.orderCode}</span>
        </div>
      </div>

      {/* Progress Bar */}
      {summary.totalItems > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-semibold text-gray-900">
              {summary.receivedItems} / {summary.totalItems} items
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                summary.isFullyReceived
                  ? "bg-green-500"
                  : summary.isPartiallyReceived
                    ? "bg-yellow-500"
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
