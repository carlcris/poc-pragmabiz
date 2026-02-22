"use client";

import { TabletHeader } from "@/components/tablet/TabletHeader";
import { PackageOpen, PackagePlus, AlertCircle, BarChart3 } from "lucide-react";
import Link from "next/link";
import { useLoadLists } from "@/hooks/useLoadLists";
import { useWarehouseDashboard } from "@/hooks/useWarehouseDashboard";
import type { LoadListStatus } from "@/types/load-list";

export default function TabletDashboardPage() {
  const { data: loadListsData, isLoading } = useLoadLists({
    page: 1,
    limit: 50,
  });
  const { data: dashboardData, isLoading: isLoadingDashboard } = useWarehouseDashboard();

  const receivingStatuses: LoadListStatus[] = ["in_transit", "receiving"];

  const pendingReceiptsCount =
    loadListsData?.data?.filter((loadList) => receivingStatuses.includes(loadList.status)).length ||
    0;

  const pendingReceiptsLabel = isLoading ? "--" : pendingReceiptsCount.toString();
  const readyToPickCount = dashboardData?.summary.pick_list_to_pick || 0;
  const readyToPickLabel = isLoadingDashboard ? "--" : readyToPickCount.toString();
  const urgentRequestCount = dashboardData?.summary.urgent_stock_requests ?? 0;
  const attentionLabel = isLoadingDashboard ? "--" : urgentRequestCount.toString();
  const attentionMessage = isLoadingDashboard
    ? "Checking urgent stock requests..."
    : urgentRequestCount === 0
      ? "All clear. No urgent stock requests right now."
      : `${attentionLabel} urgent stock request${urgentRequestCount === 1 ? "" : "s"} waiting for pick assignment`;

  return (
    <div className="min-h-screen">
      <TabletHeader
        title="Warehouse Operations"
        subtitle="Dashboard"
        showBack={false}
        warehouseName="Main Warehouse" // TODO: Get from context/API
        showLogout={true}
      />

      <div className="space-y-6 p-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Receipts</p>
                <p className="text-2xl font-bold text-gray-900">{pendingReceiptsLabel}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <PackageOpen className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Ready to Pick</p>
                <p className="text-2xl font-bold text-gray-900">{readyToPickLabel}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <PackagePlus className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Actions */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>

          <Link
            href="/tablet/receiving"
            className="block rounded-lg border border-gray-200 bg-white p-5 shadow transition-shadow hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100">
                <PackageOpen className="h-7 w-7 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Receiving</h3>
                <p className="text-sm text-gray-500">Receive incoming Shipments</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <span className="text-lg font-bold text-gray-700">{pendingReceiptsLabel}</span>
              </div>
            </div>
          </Link>

          <Link
            href="/tablet/picking"
            className="block rounded-lg border border-gray-200 bg-white p-5 shadow transition-shadow hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-green-100">
                <PackagePlus className="h-7 w-7 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Picking</h3>
                <p className="text-sm text-gray-500">Pick items from assigned pick lists</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <span className="text-lg font-bold text-gray-700">{readyToPickLabel}</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Alerts */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <h4 className="font-semibold text-amber-900">Attention Required</h4>
              <p className="mt-1 text-sm text-amber-700">{attentionMessage}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
          <div className="mb-3 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Today&apos;s Activity</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Pending Receipts</span>
              <span className="font-semibold text-gray-900">
                {isLoadingDashboard
                  ? "--"
                  : (dashboardData?.summary.incoming_deliveries_today ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pending Stock Requests</span>
              <span className="font-semibold text-gray-900">
                {isLoadingDashboard ? "--" : (dashboardData?.summary.pending_stock_requests ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pick Lists to Pick</span>
              <span className="font-semibold text-gray-900">
                {isLoadingDashboard ? "--" : (dashboardData?.summary.pick_list_to_pick ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Recent Stock Movements</span>
              <span className="font-semibold text-gray-900">
                {isLoadingDashboard ? "--" : (dashboardData?.last_stock_movements.length ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
