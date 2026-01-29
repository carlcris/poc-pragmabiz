"use client";

import { useState } from "react";
import { TabletHeader } from "@/components/tablet/TabletHeader";
import { PurchaseOrderReceivingCard } from "@/components/tablet/PurchaseOrderReceivingCard";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import type { PurchaseOrderStatus } from "@/types/purchase-order";
import { Loader2, Search, Filter } from "lucide-react";

export default function ReceivingPage() {
  type OrderStatusFilter = PurchaseOrderStatus | "all";
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("approved");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, error } = usePurchaseOrders({
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: searchQuery || undefined,
    page: 1,
    limit: 50,
  });

  const orders = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="min-h-screen">
      <TabletHeader
        title="Receiving"
        subtitle="Purchase Orders"
        showBack={true}
        backHref="/tablet"
        warehouseName="Main Warehouse"
      />

      <div className="space-y-4 p-6">
        {/* Filters */}
        <div className="space-y-3">
          {/* Status Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { value: "approved", label: "Approved" },
              { value: "in_transit", label: "In Transit" },
              { value: "partially_received", label: "Partial" },
              { value: "all", label: "All" },
            ].map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(status.value)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${
                  statusFilter === status.value
                    ? "bg-primary text-white"
                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Results Count */}
        {pagination && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {orders.length} of {pagination.total} orders
            </span>
            <button className="flex items-center gap-2 text-primary hover:underline">
              <Filter className="h-4 w-4" />
              More Filters
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
            <p className="text-gray-500">Loading orders...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">Error loading receipts</p>
            <p className="mt-1 text-sm text-red-600">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        )}

        {/* Receipts List */}
        {!isLoading && !error && orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((order) => (
              <PurchaseOrderReceivingCard key={order.id} order={order} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && orders.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow">
            <div className="mb-4 text-gray-400">
              <svg
                className="mx-auto h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No orders found</h3>
            <p className="text-gray-500">
              {searchQuery
                ? "Try adjusting your search or filters"
                : "No purchase orders available for receiving"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
