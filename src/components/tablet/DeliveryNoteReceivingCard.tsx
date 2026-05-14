"use client";

import Link from "next/link";
import { format } from "date-fns";
import { FileText, MapPin, PackageCheck, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeliveryNote } from "@/types/delivery-note";

type DeliveryNoteReceivingCardProps = {
  deliveryNote: DeliveryNote;
};

const statusColors: Record<string, string> = {
  dispatched: "bg-blue-100 text-blue-700",
  received: "bg-emerald-100 text-emerald-700",
};

const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function DeliveryNoteReceivingCard({ deliveryNote }: DeliveryNoteReceivingCardProps) {
  const items = deliveryNote.delivery_note_items || [];
  const totalDispatched = items.reduce((sum, item) => sum + toNumber(item.dispatched_qty), 0);
  const totalReceived = items.reduce((sum, item) => sum + toNumber(item.received_qty), 0);
  const progress = totalDispatched > 0 ? Math.min(100, (totalReceived / totalDispatched) * 100) : 0;
  const statusColor = statusColors[deliveryNote.status] || "bg-gray-100 text-gray-700";

  return (
    <Link
      href={`/tablet/receiving/delivery-notes/${deliveryNote.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow transition-shadow hover:shadow-md active:scale-[0.98]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-gray-600" />
            <h3 className="truncate font-bold text-gray-900">{deliveryNote.dn_no}</h3>
          </div>
          <p className="text-sm text-gray-600">
            {deliveryNote.fulfillment_mode === "customer_pickup_from_warehouse"
              ? "Customer Pickup"
              : "Warehouse Transfer"}
          </p>
        </div>

        <div className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusColor)}>
          {deliveryNote.status.replace("_", " ").toUpperCase()}
        </div>
      </div>

      <div className="mb-3 space-y-2 text-sm">
        {deliveryNote.dispatched_at && (
          <div className="flex items-center gap-2 text-gray-600">
            <Truck className="h-4 w-4" />
            <span>Dispatched: {format(new Date(deliveryNote.dispatched_at), "MMM d, yyyy")}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin className="h-4 w-4" />
          <span>Destination warehouse</span>
        </div>
        {deliveryNote.receiving_started_at && (
          <div className="flex items-center gap-2 text-gray-600">
            <PackageCheck className="h-4 w-4" />
            <span>
              Receiving started{" "}
              {format(new Date(deliveryNote.receiving_started_at), "MMM d, yyyy h:mm a")}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Received</span>
          <span className="font-semibold text-gray-900">
            {totalReceived} / {totalDispatched} units
          </span>
        </div>
        {totalDispatched > 0 && (
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                totalReceived >= totalDispatched
                  ? "bg-emerald-500"
                  : totalReceived > 0
                    ? "bg-amber-500"
                    : "bg-gray-400"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}
