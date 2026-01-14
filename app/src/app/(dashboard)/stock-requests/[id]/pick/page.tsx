"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Package, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Mock data for demonstration
const mockItems = [
  { id: '1', itemCode: 'ITM-001', itemName: 'Product A', requestedQty: 10, pickedQty: 0, uom: 'pcs', location: 'A1-01' },
  { id: '2', itemCode: 'ITM-002', itemName: 'Product B', requestedQty: 5, pickedQty: 0, uom: 'box', location: 'B2-03' },
  { id: '3', itemCode: 'ITM-003', itemName: 'Product C', requestedQty: 20, pickedQty: 0, uom: 'pcs', location: 'C3-05' },
];

export default function StockRequestPickPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [items, setItems] = useState(mockItems);

  const handlePickedQtyChange = (itemId: string, qty: number) => {
    setItems(items.map(item =>
      item.id === itemId ? { ...item, pickedQty: qty } : item
    ));
  };

  const totalItems = items.length;
  const completedItems = items.filter(item => item.pickedQty > 0).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Pick Items</h1>
          <p className="text-muted-foreground">Stock Request: {id}</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {completedItems} / {totalItems} Picked
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pick List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            This is a placeholder for the picking workflow. Enter picked quantities below.
          </p>

          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {item.pickedQty > 0 ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{item.itemName}</p>
                          <p className="text-sm text-muted-foreground">{item.itemCode}</p>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          Location: {item.location}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground mb-1">
                            Requested: {item.requestedQty} {item.uom}
                          </p>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Picked:</label>
                            <Input
                              type="number"
                              min="0"
                              max={item.requestedQty}
                              value={item.pickedQty}
                              onChange={(e) => handlePickedQtyChange(item.id, Number(e.target.value))}
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
                alert('Picking completed! This would save the picked quantities and update the request status.');
                router.back();
              }}
              disabled={completedItems === 0}
            >
              Complete Picking
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
