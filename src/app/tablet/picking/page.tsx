"use client";

import { useState } from "react";
import { TabletHeader } from "@/components/tablet/TabletHeader";
import { StockRequestPickingCard } from "@/components/tablet/StockRequestPickingCard";
import { useStockRequests } from "@/hooks/useStockRequests";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { Loader2, Search } from "lucide-react";

export default function PickingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { currentBusinessUnit } = useBusinessUnitStore();
  const { data, isLoading, error } = useStockRequests({
    status: "ready_for_pick",
    search: searchQuery || undefined,
    page: 1,
    limit: 1000,
  });

  const requests =
    data?.data?.filter((request) => {
      if (!currentBusinessUnit?.id) return true;
      return request.to_location?.businessUnitId === currentBusinessUnit.id;
    }) || [];

  return (
    <div className="min-h-screen">
      <TabletHeader
        title="Picking"
        subtitle="Stock Requests"
        showBack={true}
        backHref="/tablet"
        warehouseName="Main Warehouse"
      />

      <div className="space-y-4 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by request code..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
            <p className="text-gray-500">Loading requests...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">Error loading requests</p>
            <p className="mt-1 text-sm text-red-600">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        )}

        {!isLoading && !error && requests.length > 0 && (
          <div className="space-y-3">
            {requests.map((request) => (
              <StockRequestPickingCard key={request.id} request={request} />
            ))}
          </div>
        )}

        {!isLoading && !error && requests.length === 0 && (
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900">No ready requests</h2>
            <p className="text-gray-500">
              {searchQuery
                ? "Try adjusting your search"
                : "No stock requests are ready for picking"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
