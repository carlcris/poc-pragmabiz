"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { TabletHeader } from "@/components/tablet/TabletHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStockRequest } from "@/hooks/useStockRequests";
import { useMarkDelivered } from "@/hooks/useStockRequests";

export default function TabletPickingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;
  const { data: request, isLoading, error } = useStockRequest(requestId);
  const deliverMutation = useMarkDelivered();
  const [pickedItemIds, setPickedItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!request?.stock_request_items) return;
    const initialPicked = new Set<string>();
    request.stock_request_items.forEach((item) => {
      if (item.picked_qty >= item.requested_qty) {
        initialPicked.add(item.id);
      }
    });
    setPickedItemIds(initialPicked);
  }, [request]);

  const totalItems = request?.stock_request_items?.length || 0;
  const pickedCount = pickedItemIds.size;
  const isReadyForPick = request?.status === "ready_for_pick";
  const canMarkDelivered = isReadyForPick && totalItems > 0 && pickedCount === totalItems;

  const items = useMemo(() => request?.stock_request_items || [], [request]);

  const toggleItemPicked = (itemId: string) => {
    setPickedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const markAllPicked = () => {
    const next = new Set<string>(items.map((item) => item.id));
    setPickedItemIds(next);
  };

  const onMarkDelivered = async () => {
    if (!request) return;
    if (!canMarkDelivered) {
      toast.error("Pick all items before marking delivered.");
      return;
    }
    try {
      await deliverMutation.mutateAsync(request.id);
      router.push("/tablet/picking");
    } catch {
      // Errors handled in hook
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TabletHeader
        title="Picking"
        subtitle={request?.request_code || "Stock Request"}
        showBack={true}
        backHref="/tablet/picking"
        warehouseName="Main Warehouse"
      />

      <div className="space-y-6 p-6">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              Loading stock request...
            </CardContent>
          </Card>
        ) : error || !request ? (
          <Card>
            <CardContent className="py-8 text-center text-red-600">
              Failed to load stock request.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-gray-600">
                  <span>{request.status.replace("_", " ")}</span>
                  <span className="text-gray-300">•</span>
                  <span>{request.priority.replace("_", " ")}</span>
                </div>

                <div className="grid gap-3 text-sm text-gray-600">
                  <div>
                    <span className="font-semibold text-gray-900">Fulfilling</span>{" "}
                    {request.to_location?.warehouse_name || "Unknown destination"}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">Requesting</span>{" "}
                    {request.from_location?.warehouse_name || "Unknown source"}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">Required</span>{" "}
                    {format(new Date(request.required_date), "MMM d, yyyy")}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-900">Line Items</div>
                  <div className="text-xs text-gray-500">
                    {pickedCount} / {totalItems} picked
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Requested</TableHead>
                      <TableHead className="text-right">Picked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const itemName = item.items?.item_name || "Unknown item";
                      const packagingName = item.packaging?.name;
                      const uom = item.units_of_measure?.symbol || "";
                      const isPicked = pickedItemIds.has(item.id);

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium text-gray-900">{itemName}</div>
                            {packagingName && (
                              <div className="text-xs text-gray-500">{packagingName}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-gray-700">
                            {item.requested_qty} {uom}
                          </TableCell>
                          <TableCell className="text-right text-gray-700">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={isPicked}
                                disabled={!isReadyForPick}
                                onChange={() => toggleItemPicked(item.id)}
                              />
                              {isPicked ? item.requested_qty : 0} {uom}
                            </label>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {isReadyForPick && totalItems > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={markAllPicked}
                      disabled={pickedCount === totalItems}
                    >
                      Mark all picked
                    </Button>
                    <Button
                      type="button"
                      onClick={onMarkDelivered}
                      disabled={!canMarkDelivered || deliverMutation.isPending}
                    >
                      {deliverMutation.isPending ? "Marking..." : "Mark delivered"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
