"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusText, type StatusTextTone } from "@/components/shared/StatusText";
import { cn } from "@/lib/utils";
import type { DashboardQueues, Priority } from "@/types/warehouse-dashboard";
import {
  formatQuantity,
  formatShortDate,
  getDueState,
  parseDashboardDate,
} from "./dashboard-formatting";

type QueueKey = "pick-list" | "incoming" | "requests";

type OperationalQueueTabsProps = {
  queues: DashboardQueues;
  isLoading: boolean;
  locale: string;
  capabilities: {
    canViewPickListQueue: boolean;
    canViewIncomingDeliveriesQueue: boolean;
    canViewStockRequestsQueue: boolean;
  };
};

type QueueRow = {
  id: string;
  href: string;
  code: string;
  priority: "high" | "urgent" | null;
  status: string;
  party: string;
  lines: number;
  dateText: string;
  isDateUrgent: boolean;
};

type QueueView = {
  key: QueueKey;
  tabLabel: string;
  tabShortLabel: string;
  total: number;
  rows: QueueRow[];
  partyColumn: string;
  dateColumn: string;
  showPriority: boolean;
  emptyMessage: string;
  viewAllHref: string;
  viewAllLabel: string;
};

const STATUS_TONES: Record<string, StatusTextTone> = {
  pending: "muted",
  in_progress: "amber",
  paused: "orange",
  in_transit: "blue",
  receiving: "indigo",
  submitted: "blue",
  approved: "green",
};

const PRIORITY_TONE_CLASS = {
  urgent: "text-red-700 dark:text-red-400",
  high: "text-orange-700 dark:text-orange-400",
} as const;

// Only high and urgent are worth a reader's attention; normal and low render nothing.
const toAttentionPriority = (priority: Priority | null): QueueRow["priority"] =>
  priority === "urgent" || priority === "high" ? priority : null;

export const OperationalQueueTabs = ({
  queues,
  isLoading,
  locale,
  capabilities,
}: OperationalQueueTabsProps) => {
  const t = useTranslations("warehouseDashboard");
  const [activeTab, setActiveTab] = useState<QueueKey>("pick-list");

  const statusLabels: Record<string, string> = {
    pending: t("status_pending"),
    in_progress: t("status_in_progress"),
    paused: t("status_paused"),
    in_transit: t("status_in_transit"),
    receiving: t("status_receiving"),
    submitted: t("status_submitted"),
    approved: t("status_approved"),
  };
  const priorityLabels = { urgent: t("priority_urgent"), high: t("priority_high") };

  const describeDue = (value: string): { text: string; isUrgent: boolean } => {
    const date = parseDashboardDate(value);
    const dueState = getDueState(date);
    if (dueState === "late") {
      return { text: t("lateDate", { date: formatShortDate(date, locale) }), isUrgent: true };
    }
    if (dueState === "today") return { text: t("today"), isUrgent: true };
    return { text: formatShortDate(date, locale), isUrgent: false };
  };

  const views: QueueView[] = [];

  if (capabilities.canViewPickListQueue) {
    views.push({
      key: "pick-list",
      tabLabel: t("pickListTab"),
      tabShortLabel: t("pickListTab"),
      total: queues.totals.pick_list,
      rows: queues.pick_list.map((item) => ({
        id: item.id,
        href: `/inventory/delivery-notes/${item.delivery_note_id}`,
        code: item.pick_list_no,
        priority: null,
        status: item.status,
        party: item.created_by ?? t("unknownUser"),
        lines: item.lines,
        dateText: formatShortDate(parseDashboardDate(item.created_at), locale),
        isDateUrgent: false,
      })),
      partyColumn: t("createdByColumn"),
      dateColumn: t("createdColumn"),
      showPriority: false,
      emptyMessage: t("noItemsToPick"),
      viewAllHref: "/inventory/pick-lists",
      viewAllLabel: t("viewAllPickLists"),
    });
  }

  if (capabilities.canViewIncomingDeliveriesQueue) {
    views.push({
      key: "incoming",
      tabLabel: t("incomingTab"),
      tabShortLabel: t("incomingTab"),
      total: queues.totals.incoming_deliveries,
      rows: queues.incoming_deliveries.map((item) => {
        const due = item.eta ? describeDue(item.eta) : { text: t("noEta"), isUrgent: false };
        return {
          id: item.id,
          href: `/purchasing/load-lists/${item.id}`,
          code: item.order_code,
          priority: null,
          status: item.status,
          party: item.supplier ?? t("unknownSupplier"),
          lines: item.lines,
          dateText: due.text,
          isDateUrgent: due.isUrgent,
        };
      }),
      partyColumn: t("supplierColumn"),
      dateColumn: t("etaColumn"),
      showPriority: false,
      emptyMessage: t("noIncomingDeliveries"),
      viewAllHref: "/purchasing/load-lists",
      viewAllLabel: t("viewAllLoadLists"),
    });
  }

  if (capabilities.canViewStockRequestsQueue) {
    views.push({
      key: "requests",
      tabLabel: t("requestsTab"),
      tabShortLabel: t("requestsTabShort"),
      total: queues.totals.stock_requests,
      rows: queues.stock_requests.map((item) => {
        const due = describeDue(item.required_date);
        return {
          id: item.id,
          href: `/stock-requests/${item.id}`,
          code: item.request_code,
          priority: toAttentionPriority(item.priority),
          status: item.status,
          party: item.requested_by ?? t("unknownUser"),
          lines: item.lines,
          dateText: due.text,
          isDateUrgent: due.isUrgent,
        };
      }),
      partyColumn: t("requestedByColumn"),
      dateColumn: t("requiredColumn"),
      showPriority: true,
      emptyMessage: t("noPendingRequests"),
      viewAllHref: "/inventory/stock-requests",
      viewAllLabel: t("viewAllStockRequests"),
    });
  }

  const visibleKeys = useMemo(
    () =>
      [
        capabilities.canViewPickListQueue ? "pick-list" : null,
        capabilities.canViewIncomingDeliveriesQueue ? "incoming" : null,
        capabilities.canViewStockRequestsQueue ? "requests" : null,
      ].filter((key): key is QueueKey => key !== null),
    [
      capabilities.canViewPickListQueue,
      capabilities.canViewIncomingDeliveriesQueue,
      capabilities.canViewStockRequestsQueue,
    ]
  );

  useEffect(() => {
    if (visibleKeys.length > 0 && !visibleKeys.includes(activeTab)) {
      setActiveTab(visibleKeys[0]);
    }
  }, [activeTab, visibleKeys]);

  if (views.length === 0) return null;

  const statusLabel = (status: string) => statusLabels[status] ?? t("status_other");
  const statusTone = (status: string) => STATUS_TONES[status] ?? "muted";

  return (
    <section
      aria-labelledby="operational-queue-title"
      className="min-w-0 rounded-lg border bg-card shadow-sm"
    >
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as QueueKey)}>
        <div className="flex flex-col gap-3 border-b px-4 py-4 sm:px-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <h2 id="operational-queue-title" className="text-base font-semibold">
            {t("operationalQueue")}
          </h2>
          <TabsList
            aria-label={t("queueLabel")}
            className="grid h-auto w-full gap-1 2xl:w-auto"
            style={{ gridTemplateColumns: `repeat(${views.length}, minmax(0, 1fr))` }}
          >
            {views.map((view) => (
              <TabsTrigger
                key={view.key}
                value={view.key}
                className="h-14 flex-col gap-0.5 px-1 sm:h-11 sm:flex-row sm:gap-2 sm:px-2 lg:h-9 lg:px-3"
              >
                <span className="max-w-full truncate sm:hidden">{view.tabShortLabel}</span>
                <span className="hidden max-w-full truncate sm:inline">{view.tabLabel}</span>
                <span className="rounded-full bg-secondary px-1.5 text-xs font-semibold tabular-nums text-secondary-foreground">
                  {isLoading ? "–" : formatQuantity(view.total, locale)}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {views.map((view) => (
          <TabsContent key={view.key} value={view.key} className="mt-0">
            {isLoading ? (
              <div className="divide-y">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="flex h-16 flex-col justify-center gap-2 px-4 sm:px-5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                ))}
              </div>
            ) : view.rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {view.emptyMessage}
              </p>
            ) : (
              <>
                <ul className="divide-y lg:hidden">
                  {view.rows.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={row.href}
                        className="flex min-h-16 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold">{row.code}</span>
                            <StatusText tone={statusTone(row.status)} className="shrink-0">
                              {statusLabel(row.status)}
                            </StatusText>
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {row.priority ? (
                              <>
                                <span
                                  className={cn("font-semibold", PRIORITY_TONE_CLASS[row.priority])}
                                >
                                  {priorityLabels[row.priority]}
                                </span>
                                {" · "}
                              </>
                            ) : null}
                            {row.party} · {t("itemsCount", { count: row.lines })} ·{" "}
                            <span
                              className={cn(
                                row.isDateUrgent && "font-semibold text-red-700 dark:text-red-400",
                                "whitespace-nowrap"
                              )}
                            >
                              {row.dateText}
                            </span>
                          </span>
                        </span>
                        <ChevronRight
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>

                <table className="hidden w-full text-sm lg:table">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        {t("documentColumn")}
                      </th>
                      {view.showPriority ? (
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          {t("priorityColumn")}
                        </th>
                      ) : null}
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        {t("statusColumn")}
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        {view.partyColumn}
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">
                        {t("itemsColumn")}
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        {view.dateColumn}
                      </th>
                      <th scope="col" className="px-5 py-2.5">
                        <span className="sr-only">{t("actionColumn")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-t">
                    {view.rows.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-muted/50">
                        <td className="whitespace-nowrap px-5 py-2.5 font-semibold">{row.code}</td>
                        {view.showPriority ? (
                          <td className="whitespace-nowrap px-3 py-2.5">
                            {row.priority ? (
                              <span
                                className={cn("font-semibold", PRIORITY_TONE_CLASS[row.priority])}
                              >
                                {priorityLabels[row.priority]}
                              </span>
                            ) : null}
                          </td>
                        ) : null}
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <StatusText tone={statusTone(row.status)}>
                            {statusLabel(row.status)}
                          </StatusText>
                        </td>
                        <td className="max-w-56 truncate px-3 py-2.5" title={row.party}>
                          {row.party}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatQuantity(row.lines, locale)}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-3 py-2.5",
                            row.isDateUrgent && "font-semibold text-red-700 dark:text-red-400"
                          )}
                        >
                          {row.dateText}
                        </td>
                        <td className="px-5 py-1.5 text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={row.href} aria-label={`${t("open")} ${row.code}`}>
                              {t("open")}
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2 sm:px-5">
              <span className="text-sm text-muted-foreground">
                {isLoading
                  ? null
                  : t("shownCount", {
                      shown: formatQuantity(view.rows.length, locale),
                      total: formatQuantity(view.total, locale),
                    })}
              </span>
              <Link
                href={view.viewAllHref}
                className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9"
              >
                {view.viewAllLabel}
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
};
