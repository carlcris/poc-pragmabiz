"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Link as LinkIcon, Package, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useLinkSRsToLoadList } from "@/hooks/useLoadLists";
import { useStockRequisitions } from "@/hooks/useStockRequisitions";
import type { LoadList } from "@/types/load-list";

type LinkStockRequisitionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadList: LoadList;
};

type LinkFormItem = {
  loadListItemId: string;
  loadListItemName?: string;
  loadListQty: number;
  srItemId: string;
  srItemName?: string;
  srNumber?: string;
  requestedQty: number;
  outstandingQty: number;
  fulfilledQty: number;
};

export function LinkStockRequisitionsDialog({
  open,
  onOpenChange,
  loadList,
}: LinkStockRequisitionsDialogProps) {
  const linkMutation = useLinkSRsToLoadList();

  const [links, setLinks] = useState<LinkFormItem[]>([]);
  const [selectedLLItemId, setSelectedLLItemId] = useState("");
  const [selectedSRItemId, setSelectedSRItemId] = useState("");
  const [linkQuantity, setLinkQuantity] = useState("");
  const [addLinkError, setAddLinkError] = useState("");

  // Fetch stock requisitions that can be linked (submitted or partially_fulfilled)
  const { data: srsData } = useStockRequisitions({
    status: undefined, // We'll filter client-side to get submitted + partially_fulfilled
    supplierId: loadList.supplierId,
    limit: 50,
  });

  const availableSRs = srsData?.data?.filter(
    (sr) => sr.status === "submitted" || sr.status === "partially_fulfilled"
  ) || [];

  // Get all SR items from available SRs that have outstanding qty
  const availableSRItems = availableSRs.flatMap((sr) =>
    sr.items
      ?.filter((item) => item.outstandingQty > 0)
      .map((item) => ({
        ...item,
        srNumber: sr.srNumber,
        srId: sr.id,
      })) || []
  );

  // Get selected LL item details
  const selectedLLItem = loadList.items?.find((item) => item.id === selectedLLItemId);

  // Get selected SR item details
  const selectedSRItem = availableSRItems.find((item) => item.id === selectedSRItemId);

  useEffect(() => {
    if (open) {
      setLinks([]);
      setSelectedLLItemId("");
      setSelectedSRItemId("");
      setLinkQuantity("");
      setAddLinkError("");
    }
  }, [open]);

  const handleAddLink = () => {
    // Clear previous error
    setAddLinkError("");

    // Validation
    if (!selectedLLItemId || !selectedSRItemId || !linkQuantity) {
      setAddLinkError("Please select items and enter quantity");
      return;
    }

    const qty = parseFloat(linkQuantity);

    if (!selectedSRItem) {
      setAddLinkError("Selected SR item not found");
      return;
    }

    // Validate quantity doesn't exceed outstanding
    if (qty > selectedSRItem.outstandingQty) {
      setAddLinkError(`Quantity cannot exceed outstanding quantity (${selectedSRItem.outstandingQty})`);
      return;
    }

    // Validate quantity doesn't exceed LL item qty
    if (selectedLLItem && qty > selectedLLItem.loadListQty) {
      setAddLinkError(`Quantity cannot exceed load list quantity (${selectedLLItem.loadListQty})`);
      return;
    }

    const newLink: LinkFormItem = {
      loadListItemId: selectedLLItemId,
      loadListItemName: selectedLLItem?.item?.name,
      loadListQty: selectedLLItem?.loadListQty || 0,
      srItemId: selectedSRItemId,
      srItemName: selectedSRItem.item?.name,
      srNumber: selectedSRItem.srNumber,
      requestedQty: selectedSRItem.requestedQty,
      outstandingQty: selectedSRItem.outstandingQty,
      fulfilledQty: qty,
    };

    setLinks([...links, newLink]);
    setSelectedLLItemId("");
    setSelectedSRItemId("");
    setLinkQuantity("");
    toast.success("Link added successfully");
  };

  const handleRemoveLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (links.length === 0) {
      toast.error("Please add at least one link");
      return;
    }

    try {
      await linkMutation.mutateAsync({
        id: loadList.id,
        data: {
          links: links.map((link) => ({
            loadListItemId: link.loadListItemId,
            srItemId: link.srItemId,
            fulfilledQty: link.fulfilledQty,
          })),
        },
      });

      toast.success(
        `Successfully linked ${links.length} item${links.length > 1 ? "s" : ""} to requisitions`
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to link requisitions");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col p-0 gap-0">
        {/* Modern Header */}
        <div className="px-6 pt-6 pb-5 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-violet-600 shadow-lg">
                <LinkIcon className="h-7 w-7 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900 mb-1">
                  Link Stock Requisitions
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Link load list items to stock requisition items to track fulfillment for{" "}
                  <span className="font-semibold text-gray-700">{loadList.supplier?.name}</span>
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50">
          <div className="max-w-5xl mx-auto space-y-5">
            {/* Outstanding Requisitions Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                    <Package className="h-4 w-4 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">Outstanding Stock Requisitions</h3>
                </div>
                {availableSRItems.length > 0 ? (
                  <Badge variant="secondary" className="text-xs">
                    {availableSRItems.length} items available
                  </Badge>
                ) : availableSRs.length > 0 ? (
                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                    No items with outstanding qty
                  </Badge>
                ) : null}
              </div>

              {/* Show available SRs and their items */}
              {availableSRs.length > 0 ? (
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {availableSRs.map((sr) => {
                    const srItems = sr.items?.filter((item) => item.outstandingQty > 0) || [];
                    return (
                      <div
                        key={sr.id}
                        className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-3.5 w-3.5 text-purple-600" />
                            <span className="font-semibold text-gray-900">{sr.srNumber}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px] h-5">
                            {srItems.length} items
                          </Badge>
                        </div>
                        {srItems.length > 0 ? (
                          <div className="space-y-1 ml-5">
                            {srItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-gray-700 py-1"
                              >
                                <span className="truncate">{item.item?.name}</span>
                                <span className="font-medium text-emerald-600 ml-2 flex-shrink-0">
                                  Outstanding: {item.outstandingQty}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 ml-5 italic">
                            No items with outstanding quantity
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <Package className="h-6 w-6 text-gray-400" />
                  </div>
                  <p>No stock requisitions available for linking</p>
                  <p className="text-xs mt-1">from supplier {loadList.supplier?.name}</p>
                </div>
              )}
            </div>

            {/* Add Link Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-purple-50 to-violet-50 border-b border-purple-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600">
                    <Plus className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">Add Link</h3>
                </div>
              </div>
              <div className="p-5 bg-gradient-to-br from-purple-50/30 to-violet-50/30">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-4">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      Load List Item *
                    </label>
                    <Select
                      value={selectedLLItemId}
                      onValueChange={(value) => {
                        setSelectedLLItemId(value);
                        setAddLinkError("");
                      }}
                    >
                      <SelectTrigger className="h-10 bg-white border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                        <SelectValue placeholder="Select LL item" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadList.items?.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.item?.code} - {item.item?.name} (Qty: {item.loadListQty})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-4">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      SR Item *
                    </label>
                    <Select
                      value={selectedSRItemId}
                      onValueChange={(value) => {
                        setSelectedSRItemId(value);
                        setAddLinkError("");
                      }}
                      disabled={availableSRItems.length === 0}
                    >
                      <SelectTrigger className="h-10 bg-white border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                        <SelectValue placeholder="Select SR item" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSRItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.srNumber} - {item.item?.name} (Outstanding: {item.outstandingQty})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      Fulfilled Qty *
                    </label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={linkQuantity}
                      onChange={(e) => {
                        setLinkQuantity(e.target.value);
                        setAddLinkError("");
                      }}
                      step="0.01"
                      max={
                        selectedSRItem
                          ? Math.min(selectedSRItem.outstandingQty, selectedLLItem?.loadListQty || 0)
                          : undefined
                      }
                      className="h-10 bg-white border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>

                  <div className="col-span-2 flex items-end">
                    <Button
                      type="button"
                      onClick={handleAddLink}
                      className="w-full h-10 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 shadow-lg text-sm font-semibold"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Link
                    </Button>
                  </div>
                </div>

                {/* Inline Error Message */}
                {addLinkError && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                    <svg
                      className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <p className="text-sm text-red-800 font-medium">{addLinkError}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Links Table */}
            {links.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-5 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                        <ListChecks className="h-4 w-4 text-emerald-600" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">Links to Create</h3>
                      <Badge variant="secondary" className="text-xs">
                        {links.length} {links.length === 1 ? "link" : "links"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 border-b border-gray-200 hover:bg-gray-50">
                        <TableHead className="font-semibold text-xs text-gray-700">LL ITEM</TableHead>
                        <TableHead className="font-semibold text-xs text-gray-700">SR NUMBER</TableHead>
                        <TableHead className="font-semibold text-xs text-gray-700">SR ITEM</TableHead>
                        <TableHead className="text-right font-semibold text-xs text-gray-700">
                          REQUESTED
                        </TableHead>
                        <TableHead className="text-right font-semibold text-xs text-gray-700">
                          OUTSTANDING
                        </TableHead>
                        <TableHead className="text-right font-semibold text-xs text-gray-700">
                          FULFILLED QTY
                        </TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {links.map((link, index) => (
                        <TableRow
                          key={index}
                          className={`border-b border-gray-100 ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          } hover:bg-purple-50/50 transition-colors`}
                        >
                          <TableCell className="font-semibold text-sm text-gray-900">
                            {link.loadListItemName}
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">{link.srNumber}</TableCell>
                          <TableCell className="text-sm text-gray-700">{link.srItemName}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-gray-900">
                            {link.requestedQty}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-amber-600">
                            {link.outstandingQty}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                              {link.fulfilledQty}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveLink(index)}
                              className="hover:bg-red-50 hover:text-red-600 h-8 w-8 p-0 rounded-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-12">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-violet-100">
                    <LinkIcon className="h-8 w-8 text-purple-600" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-gray-900">No links added yet</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    Select load list and SR items above, enter quantity, then click &quot;Add Link&quot;
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {links.length > 0 && (
                <span>
                  <span className="font-semibold text-gray-900">{links.length}</span> link
                  {links.length !== 1 ? "s" : ""} ready to create
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-w-[100px] h-10 text-sm border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={linkMutation.isPending || links.length === 0}
                className="min-w-[140px] h-10 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 shadow-lg text-sm font-semibold"
              >
                {linkMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Linking...
                  </span>
                ) : (
                  `Link ${links.length} Item${links.length !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
