"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, Package, Search } from "lucide-react";
import { TabletHeader } from "@/components/tablet/TabletHeader";
import { useWarehouseDashboard } from "@/hooks/useWarehouseDashboard";

export default function PickingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data, isLoading, error } = useWarehouseDashboard();

  const pickLists = useMemo(() => {
    const rows = data?.queues.pick_list || [];
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (row) =>
        row.request_code.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q) ||
        row.requested_by.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  return (
    <div className="min-h-screen">
      <TabletHeader
        title="Picking"
        subtitle="Pick Lists Queue"
        showBack={true}
        backHref="/tablet"
        warehouseName="Main Warehouse"
      />

      <div className="space-y-4 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by pick list code, status, or assignee..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
            <p className="text-gray-500">Loading pick lists...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">Error loading pick lists</p>
            <p className="mt-1 text-sm text-red-600">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        )}

        {!isLoading && !error && pickLists.length > 0 && (
          <div className="space-y-3">
            {pickLists.map((row) => (
              <Link
                key={row.id}
                href={`/tablet/picking/${row.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow transition-shadow hover:shadow-md active:scale-[0.98]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-gray-600" />
                    <h3 className="font-bold text-gray-900">{row.request_code}</h3>
                  </div>
                  <span className="text-xs font-semibold uppercase text-blue-700">{row.status}</span>
                </div>
                <p className="text-sm text-gray-700">
                  Lines: {row.lines}
                </p>
                <p className="text-sm text-gray-600">
                  Assigned: {row.requested_by || "Unknown"}
                </p>
                <p className="text-xs text-gray-500">
                  Required:{" "}
                  {row.required_date
                    ? format(new Date(row.required_date), "MMM d, yyyy")
                    : "--"}
                </p>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && !error && pickLists.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow">
            <h2 className="mb-2 text-xl font-semibold text-gray-900">No pick lists in queue</h2>
            <p className="text-gray-500">
              {searchQuery ? "Try adjusting your search" : "No pick lists available for picking"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
