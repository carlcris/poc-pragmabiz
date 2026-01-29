"use client";

import { MobileHeader } from "@/components/mobile/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, TruckIcon } from "lucide-react";
import { useUserVanWarehouse } from "@/hooks/useVanWarehouse";
import { useStockTransfers, useConfirmStockTransfer } from "@/hooks/useStockTransfers";
import { useState } from "react";

export default function LoadPage() {
  const { data: vanData, isLoading: vanLoading } = useUserVanWarehouse();
  const { data: transfers, isLoading: transfersLoading } = useStockTransfers(
    "pending",
    vanData?.vanWarehouseId
  );
  const confirmTransfer = useConfirmStockTransfer();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const vanName = vanData?.vanWarehouse?.name || "No Van Assigned";
  const driverName = vanData?.fullName || "Driver";

  const isLoading = vanLoading || transfersLoading;
  const pendingTransfers = transfers || [];

  if (!vanLoading && !vanData?.vanWarehouseId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Load Inventory" />
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have not been assigned to a van warehouse. Please contact your supervisor.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="Load Inventory"
        subtitle="Confirm stock transfers"
        vanName={vanName}
        driverName={driverName}
      />

      <div className="space-y-4 p-4">
        {isLoading ? (
          <>
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-2 h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : pendingTransfers.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3 text-center">
                <TruckIcon className="mx-auto h-16 w-16 text-primary" />
                <h3 className="text-lg font-semibold text-gray-700">No Pending Transfers</h3>
                <p className="text-sm text-gray-500">
                  There are no pending stock transfers to your van at the moment.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          pendingTransfers.map((transfer) => (
            <Card key={transfer.id} className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{transfer.code}</CardTitle>
                    <p className="mt-1 text-xs text-gray-500">
                      From: {transfer.fromWarehouse.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(transfer.date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="secondary">{transfer.items.length} items</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transfer.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{item.quantity}</p>
                        <p className="text-xs text-gray-500">{item.uom}</p>
                      </div>
                    </div>
                  ))}
                  <Button
                    className="mt-4 w-full"
                    size="lg"
                    disabled={confirmTransfer.isPending && confirmingId === transfer.id}
                    onClick={() => {
                      setConfirmingId(transfer.id);
                      confirmTransfer.mutate(transfer.id);
                    }}
                  >
                    <CheckCircle className="mr-2 h-5 w-5" />
                    {confirmTransfer.isPending && confirmingId === transfer.id
                      ? "Confirming..."
                      : "Confirm Receipt"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
