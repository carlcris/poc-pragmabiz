"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Package, Calendar, Truck, Send, AlertCircle } from "lucide-react";
import { useLoadList } from "@/hooks/useLoadLists";
import { useGRNs, useGRN, useCreateGRN, useSubmitGRN } from "@/hooks/useGRNs";
import { TabletHeader } from "@/components/tablet/TabletHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { GRNStatus } from "@/types/grn";

interface TabletGRNPageProps {
  params: Promise<{ id: string }>;
}

export default function TabletGRNPage({ params }: TabletGRNPageProps) {
  const { id: loadListId } = use(params);
  const router = useRouter();

  // Fetch Load List
  const { data: loadList, isLoading: isLoadingLL, error: llError } = useLoadList(loadListId);

  // Fetch GRN for this Load List
  const { data: grnsData, isLoading: isLoadingGRNs } = useGRNs({
    loadListId,
    limit: 1,
  });

  const existingGRN = grnsData?.data?.[0];
  const grnId = existingGRN?.id;

  // Fetch full GRN details if we have a GRN
  const { data: grn, isLoading: isLoadingGRN } = useGRN(grnId || "");

  const createGRNMutation = useCreateGRN();
  const submitMutation = useSubmitGRN();

  const handleCreateGRN = async () => {
    if (!loadList) return;

    try {
      await createGRNMutation.mutateAsync({
        loadListId: loadList.id,
        warehouseId: loadList.warehouseId,
        containerNumber: loadList.containerNumber,
        sealNumber: loadList.sealNumber,
        batchNumber: loadList.batchNumber,
        deliveryDate: loadList.actualArrivalDate || new Date().toISOString().split("T")[0],
        items: loadList.items.map((item) => ({
          itemId: item.itemId,
          loadListQty: item.loadListQty,
          receivedQty: 0,
          damagedQty: 0,
          numBoxes: 0,
        })),
      });
      toast.success("GRN created successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create GRN");
    }
  };

  const handleSubmit = async () => {
    if (!grn) return;

    try {
      await submitMutation.mutateAsync(grn.id);
      toast.success("GRN submitted for approval");
      router.push("/tablet/receiving");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit GRN");
    }
  };

  const getStatusBadge = (status: GRNStatus) => {
    switch (status) {
      case "draft":
        return <span className="text-base text-gray-600">Draft</span>;
      case "receiving":
        return <span className="text-base text-amber-700">Receiving</span>;
      case "pending_approval":
        return <span className="text-base text-yellow-700">Pending Approval</span>;
      case "approved":
        return <span className="text-base text-green-700">Approved</span>;
      default:
        return <span className="text-base text-gray-600">{status}</span>;
    }
  };

  const isLoading = isLoadingLL || isLoadingGRNs || (grnId && isLoadingGRN);
  const canSubmit = grn?.status === "draft" || grn?.status === "receiving";

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <TabletHeader
          title="Loading..."
          subtitle="Please wait"
          showBack={true}
          backHref="/tablet/receiving"
          warehouseName="Main Warehouse"
        />
        <div className="flex h-[calc(100vh-200px)] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-gray-500">Loading receiving details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (llError || !loadList) {
    return (
      <div className="min-h-screen">
        <TabletHeader
          title="Error"
          subtitle="Load List not found"
          showBack={true}
          backHref="/tablet/receiving"
          warehouseName="Main Warehouse"
        />
        <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center gap-4 p-6">
          <AlertCircle className="h-16 w-16 text-red-500" />
          <p className="text-lg text-red-600">Failed to load Load List</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  // If no GRN exists, show create button
  if (!grn && !createGRNMutation.isPending) {
    return (
      <div className="min-h-screen">
        <TabletHeader
          title={loadList.llNumber}
          subtitle="Goods Receipt Note"
          showBack={true}
          backHref="/tablet/receiving"
          warehouseName={loadList.warehouse?.name || "Main Warehouse"}
        />
        <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center gap-6 p-6">
          <Package className="h-20 w-20 text-gray-400" />
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-900">No GRN Found</h3>
            <p className="mt-2 text-gray-600">
              Create a Goods Receipt Note to start receiving items from this load list.
            </p>
          </div>
          <Button onClick={handleCreateGRN} size="lg" className="px-8">
            <Package className="mr-2 h-5 w-5" />
            Create GRN
          </Button>
        </div>
      </div>
    );
  }

  if (createGRNMutation.isPending) {
    return (
      <div className="min-h-screen">
        <TabletHeader
          title={loadList.llNumber}
          subtitle="Creating GRN"
          showBack={true}
          backHref="/tablet/receiving"
          warehouseName={loadList.warehouse?.name || "Main Warehouse"}
        />
        <div className="flex h-[calc(100vh-200px)] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-gray-500">Creating GRN...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!grn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TabletHeader
        title={grn.grnNumber}
        subtitle={loadList.llNumber}
        showBack={true}
        backHref="/tablet/receiving"
        warehouseName={loadList.warehouse?.name || "Main Warehouse"}
      />

      <div className="space-y-4 p-6">
        {/* Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">GRN Status</p>
                {getStatusBadge(grn.status)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GRN Details */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-5 w-5 text-gray-600" />
                Shipment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {grn.containerNumber && (
                <div>
                  <Label className="text-xs text-gray-500">Container Number</Label>
                  <p className="text-sm font-medium text-gray-900">{grn.containerNumber}</p>
                </div>
              )}
              {grn.sealNumber && (
                <div>
                  <Label className="text-xs text-gray-500">Seal Number</Label>
                  <p className="text-sm font-medium text-gray-900">{grn.sealNumber}</p>
                </div>
              )}
              {grn.batchNumber && (
                <div>
                  <Label className="text-xs text-gray-500">Batch Number</Label>
                  <p className="text-sm font-medium text-gray-900">{grn.batchNumber}</p>
                </div>
              )}
              {loadList.supplier && (
                <div>
                  <Label className="text-xs text-gray-500">Supplier</Label>
                  <p className="text-sm font-medium text-gray-900">{loadList.supplier.name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5 text-gray-600" />
                Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500">Delivery Date</Label>
                <p className="text-sm font-medium text-gray-900">
                  {grn.deliveryDate ? format(new Date(grn.deliveryDate), "MMM dd, yyyy") : "-"}
                </p>
              </div>
              {grn.receivingDate && (
                <div>
                  <Label className="text-xs text-gray-500">Receiving Date</Label>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(grn.receivingDate), "MMM dd, yyyy")}
                  </p>
                </div>
              )}
              {loadList.estimatedArrivalDate && (
                <div>
                  <Label className="text-xs text-gray-500">Estimated Arrival</Label>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(loadList.estimatedArrivalDate), "MMM dd, yyyy")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Receiving Checklist */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Receiving Checklist</CardTitle>
                <CardDescription>View received items status</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-700">
                  {grn.items.filter((item) => (item.receivedQty || 0) > 0).length}
                  <span className="text-base font-normal text-gray-600">/{grn.items.length}</span>
                </p>
                <p className="text-xs text-gray-500">Items Checked</p>
              </div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-violet-600 transition-all"
                style={{
                  width: `${
                    (grn.items.filter((item) => (item.receivedQty || 0) > 0).length / grn.items.length) * 100
                  }%`,
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-2 p-4">
              {grn.items.map((item) => {
                const receivedQty = item.receivedQty || 0;
                const damagedQty = item.damagedQty || 0;
                const numBoxes = item.numBoxes || 0;
                const variance = receivedQty - item.loadListQty;
                const isChecked = receivedQty > 0;
                const hasIssues = damagedQty > 0 || variance < 0;

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border-2 p-4 transition-all ${
                      isChecked
                        ? hasIssues
                          ? "border-amber-300 bg-amber-50"
                          : "border-emerald-300 bg-emerald-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    {/* Header with Checkbox */}
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex-shrink-0 pt-1">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                            isChecked
                              ? hasIssues
                                ? "border-amber-500 bg-amber-500"
                                : "border-emerald-500 bg-emerald-500"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {isChecked && (
                            <svg
                              className="h-5 w-5 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`font-bold ${isChecked ? "text-gray-900" : "text-gray-700"}`}>
                              {item.item?.name || "-"}
                            </p>
                            <p className="text-sm text-gray-600">{item.item?.code || "-"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Expected</p>
                            <p className="text-xl font-bold text-gray-900">{item.loadListQty}</p>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {isChecked && !hasIssues && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              ✓ Received
                            </span>
                          )}
                          {hasIssues && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                              ⚠ Issues Found
                            </span>
                          )}
                          {variance !== 0 && isChecked && (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                variance > 0
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {variance > 0 ? "+" : ""}
                              {variance} variance
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* View-Only Data */}
                    <div className="space-y-2 border-t border-gray-200 pt-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-600">Received</p>
                          <p className="text-2xl font-bold text-gray-900">{receivedQty}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-red-600">Damaged</p>
                          <p className="text-2xl font-bold text-red-700">{damagedQty}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-blue-600">Boxes</p>
                          <p className="text-2xl font-bold text-blue-700">{numBoxes}</p>
                        </div>
                      </div>
                      {item.notes && (
                        <div className="mt-3 rounded-md bg-gray-50 p-3">
                          <p className="text-xs font-semibold text-gray-500">Notes</p>
                          <p className="mt-1 text-sm text-gray-700">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Actions - Mobile Optimized */}
        {canSubmit && (
          <div className="sticky bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4 shadow-2xl">
            <div className="mx-auto flex max-w-4xl justify-center">
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                size="lg"
                className="h-14 w-full bg-gradient-to-r from-purple-600 to-violet-600 text-base font-semibold hover:from-purple-700 hover:to-violet-700 sm:w-auto sm:px-12"
              >
                <Send className="mr-2 h-5 w-5" />
                {submitMutation.isPending ? "Submitting..." : "Submit for Approval"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
