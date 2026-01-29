import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, TruckIcon, ClipboardList } from "lucide-react";
import Link from "next/link";
import type {
  PickListItem,
  IncomingDeliveryItem,
  StockRequestItem,
  DashboardQueues,
} from "@/types/warehouse-dashboard";
import { StatusBadge, PriorityBadge } from "./StatusBadge";

type OperationalQueueTabsProps = {
  queues: DashboardQueues;
  isLoading: boolean;
};

export const OperationalQueueTabs = ({ queues, isLoading }: OperationalQueueTabsProps) => {
  const [activeTab, setActiveTab] = useState("pick-list");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Operational Queue
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pick-list" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Pick List ({queues.pick_list.length})
            </TabsTrigger>
            <TabsTrigger value="incoming" className="flex items-center gap-2">
              <TruckIcon className="h-4 w-4" />
              Incoming ({queues.incoming_deliveries.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Requests ({queues.stock_requests.length})
            </TabsTrigger>
          </TabsList>

          {/* Pick List Tab */}
          <TabsContent value="pick-list" className="mt-4 space-y-2">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : queues.pick_list.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No items to pick</p>
            ) : (
              queues.pick_list.map((item) => <PickListCard key={item.id} item={item} />)
            )}
          </TabsContent>

          {/* Incoming Deliveries Tab */}
          <TabsContent value="incoming" className="mt-4 space-y-2">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : queues.incoming_deliveries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No incoming deliveries
              </p>
            ) : (
              queues.incoming_deliveries.map((item) => (
                <IncomingDeliveryCard key={item.id} item={item} />
              ))
            )}
          </TabsContent>

          {/* Stock Requests Tab */}
          <TabsContent value="requests" className="mt-4 space-y-2">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : queues.stock_requests.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No pending requests</p>
            ) : (
              queues.stock_requests.map((item) => <StockRequestCard key={item.id} item={item} />)
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// Sub-components for each queue type

type PickListCardProps = {
  item: PickListItem;
};

const PickListCard = ({ item }: PickListCardProps) => (
  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
    <Link href={`/stock-requests/${item.id}`} className="flex-1">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{item.request_code}</p>
          <PriorityBadge priority={item.priority} />
          <StatusBadge status={item.status} />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{item.lines} items</span>
          <span>•</span>
          <span>Due: {new Date(item.required_date).toLocaleDateString()}</span>
          <span>•</span>
          <span>By: {item.requested_by}</span>
        </div>
      </div>
    </Link>
  </div>
);

type IncomingDeliveryCardProps = {
  item: IncomingDeliveryItem;
};

const IncomingDeliveryCard = ({ item }: IncomingDeliveryCardProps) => (
  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
    <Link href={`/purchase-orders/${item.id}`} className="flex-1">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{item.order_code}</p>
          <PriorityBadge priority={item.priority} />
          <StatusBadge status={item.status} />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{item.supplier}</span>
          <span>•</span>
          <span>{item.lines} items</span>
          <span>•</span>
          <span>ETA: {new Date(item.eta).toLocaleDateString()}</span>
        </div>
      </div>
    </Link>
  </div>
);

type StockRequestCardProps = {
  item: StockRequestItem;
};

const StockRequestCard = ({ item }: StockRequestCardProps) => (
  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
    <Link href={`/stock-requests/${item.id}`} className="flex-1">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{item.request_code}</p>
          <PriorityBadge priority={item.priority} />
          <StatusBadge status={item.status} />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>By: {item.requested_by}</span>
          <span>•</span>
          <span>{item.lines} items</span>
          <span>•</span>
          <span>Required: {new Date(item.required_date).toLocaleDateString()}</span>
        </div>
      </div>
    </Link>
  </div>
);
