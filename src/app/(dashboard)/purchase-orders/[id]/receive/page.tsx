"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, TruckIcon, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Mock data for demonstration
const mockItems = [
  {
    id: "1",
    itemCode: "ITM-001",
    itemName: "Product A",
    orderedQty: 100,
    receivedQty: 0,
    uom: "pcs",
  },
  {
    id: "2",
    itemCode: "ITM-002",
    itemName: "Product B",
    orderedQty: 50,
    receivedQty: 0,
    uom: "box",
  },
  {
    id: "3",
    itemCode: "ITM-003",
    itemName: "Product C",
    orderedQty: 200,
    receivedQty: 0,
    uom: "pcs",
  },
];

export default function PurchaseOrderReceivePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [items, setItems] = useState(mockItems);

  const handleReceivedQtyChange = (itemId: string, qty: number) => {
    setItems(items.map((item) => (item.id === itemId ? { ...item, receivedQty: qty } : item)));
  };

  const totalItems = items.length;
  const receivedItems = items.filter((item) => item.receivedQty > 0).length;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Receive Goods</h1>
          <p className="text-muted-foreground">Purchase Order: {id}</p>
        </div>
        <Badge variant="outline" className="px-4 py-2 text-lg">
          {receivedItems} / {totalItems} Received
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TruckIcon className="h-5 w-5" />
            Receiving List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            This is a placeholder for the receiving workflow. Enter received quantities below.
          </p>

          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0">
                      {item.receivedQty > 0 ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <TruckIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div>
                        <p className="font-semibold">{item.itemName}</p>
                        <p className="text-sm text-muted-foreground">{item.itemCode}</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="mb-1 text-sm text-muted-foreground">
                            Ordered: {item.orderedQty} {item.uom}
                          </p>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Received:</label>
                            <Input
                              type="number"
                              min="0"
                              max={item.orderedQty}
                              value={item.receivedQty}
                              onChange={(e) =>
                                handleReceivedQtyChange(item.id, Number(e.target.value))
                              }
                              className="w-24"
                            />
                            <span className="text-sm">{item.uom}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 pt-6">
            <Button
              onClick={() => {
                alert(
                  "Receiving completed! This would create a purchase receipt and update stock levels."
                );
                router.push("/purchase-orders");
              }}
              disabled={receivedItems === 0}
            >
              Complete Receiving
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const allReceived = items.every((item) => item.receivedQty === item.orderedQty);
                if (allReceived) {
                  alert("Partial receive completed! This would create a partial purchase receipt.");
                  router.push("/purchase-orders");
                } else {
                  setItems(items.map((item) => ({ ...item, receivedQty: item.orderedQty })));
                }
              }}
            >
              Receive All
            </Button>
            <Button variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
