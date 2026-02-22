"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  Package,
  Warehouse,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Save,
  Send,
} from "lucide-react";
import { useGRN, useUpdateGRN, useSubmitGRN, useApproveGRN, useRejectGRN } from "@/hooks/useGRNs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GRNStatus, GRNItem } from "@/types/grn";

const DamagedItemsSection = dynamic(
  () => import("@/components/grns/DamagedItemsSection").then((mod) => mod.DamagedItemsSection),
  {
    ssr: false,
    loading: () => <div className="p-4 text-sm text-muted-foreground">Loading damage items...</div>,
  }
);

const BoxManagementSection = dynamic(
  () => import("@/components/grns/BoxManagementSection").then((mod) => mod.BoxManagementSection),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 text-sm text-muted-foreground">Loading box management...</div>
    ),
  }
);

interface GRNDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function GRNDetailPage({ params }: GRNDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: grn, isLoading, error } = useGRN(id);
  const updateMutation = useUpdateGRN();
  const submitMutation = useSubmitGRN();
  const approveMutation = useApproveGRN();
  const rejectMutation = useRejectGRN();

  const [editedItems, setEditedItems] = useState<
    Record<
      string,
      {
        receivedQty: number;
        damagedQty: number;
        numBoxes: number;
        notes: string;
      }
    >
  >({});
  const [notes, setNotes] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const getStatusBadge = (status: GRNStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "receiving":
        return (
          <Badge
            variant="outline"
            className="border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-400"
          >
            Receiving
          </Badge>
        );
      case "pending_approval":
        return (
          <Badge
            variant="outline"
            className="border-yellow-600 text-yellow-700 dark:border-yellow-400 dark:text-yellow-400"
          >
            Pending Approval
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
          >
            Approved
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleItemChange = (
    itemId: string,
    field: "receivedQty" | "damagedQty" | "numBoxes" | "notes",
    value: number | string
  ) => {
    const currentItem = grn?.items.find((item) => item.id === itemId);
    setEditedItems((prev) => ({
      ...prev,
      [itemId]: {
        receivedQty: prev[itemId]?.receivedQty ?? currentItem?.receivedQty ?? 0,
        damagedQty: prev[itemId]?.damagedQty ?? currentItem?.damagedQty ?? 0,
        numBoxes: prev[itemId]?.numBoxes ?? currentItem?.numBoxes ?? 0,
        notes: prev[itemId]?.notes ?? currentItem?.notes ?? "",
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!grn) return;

    try {
      const itemsToUpdate = Object.entries(editedItems).map(([itemId, data]) => ({
        id: itemId,
        receivedQty: data.receivedQty,
        damagedQty: data.damagedQty,
        numBoxes: data.numBoxes,
        notes: data.notes,
      }));

      await updateMutation.mutateAsync({
        id: grn.id,
        data: {
          receivingDate: grn.receivingDate || new Date().toISOString().split("T")[0],
          notes: notes || grn.notes,
          items: itemsToUpdate,
        },
      });

      toast.success("GRN updated successfully");
      setEditedItems({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update GRN");
    }
  };

  const handleSubmit = async () => {
    if (!grn) return;

    try {
      await submitMutation.mutateAsync(grn.id);
      toast.success("GRN submitted for approval");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit GRN");
    }
  };

  const handleApprove = async () => {
    if (!grn) return;

    try {
      await approveMutation.mutateAsync({ id: grn.id, notes });
      toast.success("GRN approved successfully");
      setApproveDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve GRN");
    }
  };

  const handleReject = async () => {
    if (!grn || !rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      await rejectMutation.mutateAsync({ id: grn.id, reason: rejectReason });
      toast.success("GRN rejected");
      setRejectDialogOpen(false);
      setRejectReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject GRN");
    }
  };

  const getItemValue = (
    item: GRNItem,
    field: "receivedQty" | "damagedQty" | "numBoxes" | "notes"
  ) => {
    const value = editedItems[item.id] ? editedItems[item.id][field] : item[field];
    if (field === "notes") {
      return value ?? "";
    }
    return value ?? 0;
  };

  const isEditable = grn?.status === "draft" || grn?.status === "receiving";
  const canSubmit = grn?.status === "draft" || grn?.status === "receiving";
  const canApprove = grn?.status === "pending_approval";

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !grn) {
    return (
      <div className="flex h-[calc(100vh-200px)] flex-col items-center justify-center gap-4">
        <p className="text-destructive">Failed to load GRN. Please try again.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Modern Header */}
      <div className="bg-white border-b border-gray-200 -mx-6 px-6 py-6 sticky top-0 z-10 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="mt-1 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 shadow-md">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{grn.grnNumber}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(grn.status)}
                    {grn.loadList && (
                      <span className="text-sm text-gray-500">
                        • Load List: <span className="font-medium text-gray-700">{grn.loadList.llNumber}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditable && (
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 shadow-md"
              >
                <Save className="mr-2 h-4 w-4" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            )}
            {canSubmit && (
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 shadow-md"
              >
                <Send className="mr-2 h-4 w-4" />
                {submitMutation.isPending ? "Submitting..." : "Submit for Approval"}
              </Button>
            )}
            {canApprove && (
              <>
                <Button
                  onClick={() => setApproveDialogOpen(true)}
                  disabled={approveMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 shadow-md"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={rejectMutation.isPending}
                  className="shadow-md"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* GRN Details - Modern Card Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* GRN Information */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 pb-4">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                <Package className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="font-semibold text-gray-900">GRN Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">GRN Number</Label>
              <p className="mt-1 text-sm font-semibold text-gray-900">{grn.grnNumber}</p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Load List</Label>
              <p className="mt-1 text-sm font-medium text-gray-900">{grn.loadList?.llNumber || "-"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Container</Label>
                <p className="mt-1 text-sm font-medium text-gray-900">{grn.containerNumber || "-"}</p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Seal</Label>
                <p className="mt-1 text-sm font-medium text-gray-900">{grn.sealNumber || "-"}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch Number</Label>
              <p className="mt-1 text-sm font-medium text-gray-900">{grn.batchNumber || "-"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Location & Dates */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 pb-4">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <Warehouse className="h-4 w-4 text-blue-600" />
              </div>
              <span className="font-semibold text-gray-900">Location & Dates</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Warehouse</Label>
              <p className="mt-1 text-sm font-semibold text-gray-900">{grn.warehouse?.name || "-"}</p>
              {grn.warehouse?.code && (
                <p className="text-xs text-gray-500">{grn.warehouse.code}</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Business Unit</Label>
              <p className="mt-1 text-sm font-medium text-gray-900">{grn.businessUnit?.name || "-"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Delivery Date</Label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {grn.deliveryDate ? format(new Date(grn.deliveryDate), "MMM dd, yyyy") : "-"}
                </p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Receiving Date</Label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {grn.receivingDate ? format(new Date(grn.receivingDate), "MMM dd, yyyy") : <span className="text-gray-400">Not started</span>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supplier & Personnel Combined */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 pb-4">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                <User className="h-4 w-4 text-purple-600" />
              </div>
              <span className="font-semibold text-gray-900">Supplier & Personnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {grn.loadList?.supplier && (
              <div className="pb-4 border-b border-gray-100">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Supplier</Label>
                <p className="mt-1 text-sm font-semibold text-gray-900">{grn.loadList.supplier.name}</p>
                <p className="text-xs text-gray-500">{grn.loadList.supplier.code}</p>
              </div>
            )}
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Created By</Label>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {grn.createdByUser
                  ? `${grn.createdByUser.firstName} ${grn.createdByUser.lastName}`
                  : "-"}
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Received By</Label>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {grn.receivedByUser
                  ? `${grn.receivedByUser.firstName} ${grn.receivedByUser.lastName}`
                  : "-"}
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Checked By</Label>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {grn.checkedByUser
                  ? `${grn.checkedByUser.firstName} ${grn.checkedByUser.lastName}`
                  : "-"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="receive-items" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="receive-items">Receive Items</TabsTrigger>
          <TabsTrigger value="damage-items">Damage Items</TabsTrigger>
          <TabsTrigger value="box-management">Box Labels Management</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="receive-items">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2.5 text-base">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
                      <Package className="h-4 w-4 text-indigo-600" />
                    </div>
                    <span className="font-semibold text-gray-900">Received Items</span>
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {isEditable ? "Enter received quantities and damage information" : "View received items details"}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {grn.items.length} {grn.items.length === 1 ? "item" : "items"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-200 hover:bg-gray-50">
                      <TableHead className="font-semibold text-xs text-gray-700">ITEM CODE</TableHead>
                      <TableHead className="font-semibold text-xs text-gray-700">ITEM NAME</TableHead>
                      <TableHead className="text-right font-semibold text-xs text-gray-700">EXPECTED</TableHead>
                      <TableHead className="text-right font-semibold text-xs text-gray-700">RECEIVED</TableHead>
                      <TableHead className="text-right font-semibold text-xs text-gray-700">DAMAGED</TableHead>
                      <TableHead className="text-right font-semibold text-xs text-gray-700">BOXES</TableHead>
                      <TableHead className="text-right font-semibold text-xs text-gray-700">VARIANCE</TableHead>
                      <TableHead className="font-semibold text-xs text-gray-700 min-w-[200px]">NOTES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grn.items.map((item, index) => {
                      const receivedQty = Number(getItemValue(item, "receivedQty")) || 0;
                      const variance = receivedQty - item.loadListQty;
                      const varianceClass =
                        variance > 0 ? "text-emerald-600 bg-emerald-50" : variance < 0 ? "text-red-600 bg-red-50" : "text-gray-600";

                      return (
                        <TableRow key={item.id} className={`border-b border-gray-100 ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/50 transition-colors`}>
                          <TableCell className="font-semibold text-sm text-gray-900">{item.item?.code || "-"}</TableCell>
                          <TableCell className="text-sm text-gray-700">{item.item?.name || "-"}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-gray-900">{item.loadListQty}</TableCell>
                          <TableCell className="text-right">
                            {isEditable ? (
                              <Input
                                type="number"
                                min="0"
                                value={getItemValue(item, "receivedQty")}
                                onChange={(e) =>
                                  handleItemChange(item.id, "receivedQty", parseFloat(e.target.value) || 0)
                                }
                                className="w-24 h-9 text-right text-sm border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-900">{receivedQty}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditable ? (
                              <Input
                                type="number"
                                min="0"
                                value={getItemValue(item, "damagedQty")}
                                onChange={(e) =>
                                  handleItemChange(item.id, "damagedQty", parseFloat(e.target.value) || 0)
                                }
                                className="w-24 h-9 text-right text-sm border-gray-300 focus:border-red-500 focus:ring-red-500"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-900">{getItemValue(item, "damagedQty")}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditable ? (
                              <Input
                                type="number"
                                min="0"
                                value={getItemValue(item, "numBoxes")}
                                onChange={(e) =>
                                  handleItemChange(item.id, "numBoxes", parseInt(e.target.value) || 0)
                                }
                                className="w-24 h-9 text-right text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-900">{getItemValue(item, "numBoxes")}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${varianceClass}`}>
                              {variance > 0 ? "+" : ""}
                              {variance}
                            </span>
                          </TableCell>
                          <TableCell>
                            {isEditable ? (
                              <Input
                                type="text"
                                value={getItemValue(item, "notes")}
                                onChange={(e) => handleItemChange(item.id, "notes", e.target.value)}
                                className="w-full h-9 text-sm border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                                placeholder="Add notes..."
                              />
                            ) : (
                              <span className="text-sm text-gray-700">{getItemValue(item, "notes") || "-"}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="damage-items">
          <DamagedItemsSection grnId={grn.id} grnItems={grn.items} isEditable={isEditable} />
        </TabsContent>

        <TabsContent value="box-management">
          <BoxManagementSection grn={grn} isEditable={isEditable} />
        </TabsContent>

        <TabsContent value="notes">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-100">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                  <Calendar className="h-4 w-4 text-amber-600" />
                </div>
                <span className="font-semibold text-gray-900">Additional Notes</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {grn.notes ? (
                <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{grn.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes added.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve GRN</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve {grn.grnNumber}? This will create stock entries and
              update inventory levels. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="approve-notes">Approval Notes (optional)</Label>
            <Textarea
              id="approve-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any approval notes..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject GRN</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject {grn.grnNumber}? Please provide a reason for rejection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">Rejection Reason *</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={3}
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
