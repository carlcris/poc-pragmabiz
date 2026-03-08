"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  locale: string;
};

export const OperationalQueueTabs = ({ queues, isLoading, locale }: OperationalQueueTabsProps) => {
  const t = useTranslations("warehouseDashboard");
  const [activeTab, setActiveTab] = useState("pick-list");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          {t("operationalQueue")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pick-list" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t("pickListTab", { count: queues.pick_list.length })}
            </TabsTrigger>
            <TabsTrigger value="incoming" className="flex items-center gap-2">
              <TruckIcon className="h-4 w-4" />
              {t("incomingTab", { count: queues.incoming_deliveries.length })}
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {t("requestsTab", { count: queues.stock_requests.length })}
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
              <p className="py-8 text-center text-sm text-muted-foreground">{t("noItemsToPick")}</p>
            ) : (
              queues.pick_list.map((item) => <PickListCard key={item.id} item={item} locale={locale} />)
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
                {t("noIncomingDeliveries")}
              </p>
            ) : (
              queues.incoming_deliveries.map((item) => (
                <IncomingDeliveryCard key={item.id} item={item} locale={locale} />
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
              <p className="py-8 text-center text-sm text-muted-foreground">{t("noPendingRequests")}</p>
            ) : (
              queues.stock_requests.map((item) => <StockRequestCard key={item.id} item={item} locale={locale} />)
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
  locale: string;
};

const PickListCard = ({ item, locale }: PickListCardProps) => {
  const t = useTranslations("warehouseDashboard");
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
      <Link href={`/stock-requests/${item.id}`} className="flex-1">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{item.request_code}</p>
            <PriorityBadge priority={item.priority} label={t(`priority_${item.priority}`)} />
            <StatusBadge status={item.status} label={t(`status_${item.status}`)} />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{t("itemsCount", { count: item.lines })}</span>
            <span>•</span>
            <span>{t("dueLabel")}: {new Date(item.required_date).toLocaleDateString(locale)}</span>
            <span>•</span>
            <span>{t("byLabel")}: {item.requested_by}</span>
          </div>
        </div>
      </Link>
    </div>
  );
};

type IncomingDeliveryCardProps = {
  item: IncomingDeliveryItem;
  locale: string;
};

const IncomingDeliveryCard = ({ item, locale }: IncomingDeliveryCardProps) => {
  const t = useTranslations("warehouseDashboard");
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
      <Link href={`/purchasing/load-lists/${item.id}`} className="flex-1">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{item.order_code}</p>
            <PriorityBadge priority={item.priority} label={t(`priority_${item.priority}`)} />
            <StatusBadge status={item.status} label={t(`status_${item.status}`)} />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{item.supplier}</span>
            <span>•</span>
            <span>{t("itemsCount", { count: item.lines })}</span>
            <span>•</span>
            <span>
              {t("etaLabel")}: {item.eta ? new Date(item.eta).toLocaleDateString(locale) : "--"}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
};

type StockRequestCardProps = {
  item: StockRequestItem;
  locale: string;
};

const StockRequestCard = ({ item, locale }: StockRequestCardProps) => {
  const t = useTranslations("warehouseDashboard");
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
      <Link href={`/stock-requests/${item.id}`} className="flex-1">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{item.request_code}</p>
            <PriorityBadge priority={item.priority} label={t(`priority_${item.priority}`)} />
            <StatusBadge status={item.status} label={t(`status_${item.status}`)} />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{t("byLabel")}: {item.requested_by}</span>
            <span>•</span>
            <span>{t("itemsCount", { count: item.lines })}</span>
            <span>•</span>
            <span>{t("requiredLabel")}: {new Date(item.required_date).toLocaleDateString(locale)}</span>
          </div>
        </div>
      </Link>
    </div>
  );
};
