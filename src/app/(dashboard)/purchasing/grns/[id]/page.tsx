"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { toast } from "sonner";
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
    loading: () => (
      <div className="flex items-center justify-center p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    ),
  }
);

const BoxManagementSection = dynamic(
  () => import("@/components/grns/BoxManagementSection").then((mod) => mod.BoxManagementSection),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    ),
  }
);

interface GRNDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function GRNDetailPage({ params }: GRNDetailPageProps) {
  const t = useTranslations("grnDetailPage");
  const common = useTranslations("common");
  const locale = useLocale();
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

  const formatDate = (dateString?: string | null, fallback = t("noValue")) => {
    if (!dateString) return fallback;
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(dateString));
  };

  const getStatusBadge = (status: GRNStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">{t("draft")}</Badge>;
      case "receiving":
        return (
          <Badge
            variant="outline"
            className="border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-400"
          >
            {t("receiving")}
          </Badge>
        );
      case "pending_approval":
        return (
          <Badge
            variant="outline"
            className="border-yellow-600 text-yellow-700 dark:border-yellow-400 dark:text-yellow-400"
          >
            {t("pendingApproval")}
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
          >
            {t("approved")}
          </Badge>
        );
      case "rejected":
        return <Badge variant="destructive">{t("rejected")}</Badge>;
      case "cancelled":
        return <Badge variant="destructive">{t("cancelled")}</Badge>;
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

      toast.success(t("updateSuccess"));
      setEditedItems({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("updateError"));
    }
  };

  const handleSubmit = async () => {
    if (!grn) return;

    try {
      await submitMutation.mutateAsync(grn.id);
      toast.success(t("submitSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("submitError"));
    }
  };

  const handleApprove = async () => {
    if (!grn) return;

    try {
      await approveMutation.mutateAsync({ id: grn.id, notes });
      toast.success(t("approveSuccess"));
      setApproveDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("approveError"));
    }
  };

  const handleReject = async () => {
    if (!grn || !rejectReason.trim()) {
      toast.error(t("rejectReasonRequired"));
      return;
    }

    try {
      await rejectMutation.mutateAsync({ id: grn.id, reason: rejectReason });
      toast.success(t("rejectSuccess"));
      setRejectDialogOpen(false);
      setRejectReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("rejectError"));
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
        <p className="text-destructive">{t("loadError")}</p>
        <Button onClick={() => router.back()}>{t("goBack")}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="sticky top-0 z-10 -mx-6 border-b border-gray-200 bg-white px-6 py-6 shadow-sm">
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
                  <div className="mt-1 flex items-center gap-2">
                    {getStatusBadge(grn.status)}
                    {grn.loadList && (
                      <span className="text-sm text-gray-500">
                        • {t("loadListLabel", { value: grn.loadList.llNumber })}
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
                className="bg-blue-600 shadow-md hover:bg-blue-700"
              >
                <Save className="mr-2 h-4 w-4" />
                {updateMutation.isPending ? t("saving") : t("saveChanges")}
              </Button>
            )}
            {canSubmit && (
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-violet-600 shadow-md hover:from-purple-700 hover:to-violet-700"
              >
                <Send className="mr-2 h-4 w-4" />
                {submitMutation.isPending ? t("submitting") : t("submitForApproval")}
              </Button>
            )}
            {canApprove && (
              <>
                <Button
                  onClick={() => setApproveDialogOpen(true)}
                  disabled={approveMutation.isPending}
                  className="bg-emerald-600 shadow-md hover:bg-emerald-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t("approve")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={rejectMutation.isPending}
                  className="shadow-md"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {t("reject")}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 pb-4">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                <Package className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="font-semibold text-gray-900">{t("grnInformation")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("grnNumber")}</Label>
              <p className="mt-1 text-sm font-semibold text-gray-900">{grn.grnNumber}</p>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("loadList")}</Label>
              <p className="mt-1 text-sm font-medium text-gray-900">{grn.loadList?.llNumber || t("noValue")}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("container")}</Label>
                <p className="mt-1 text-sm font-medium text-gray-900">{grn.containerNumber || t("noValue")}</p>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("seal")}</Label>
                <p className="mt-1 text-sm font-medium text-gray-900">{grn.sealNumber || t("noValue")}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("batchNumber")}</Label>
              <p className="mt-1 text-sm font-medium text-gray-900">{grn.batchNumber || t("noValue")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 pb-4">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <Warehouse className="h-4 w-4 text-blue-600" />
              </div>
              <span className="font-semibold text-gray-900">{t("locationDates")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("warehouse")}</Label>
              <p className="mt-1 text-sm font-semibold text-gray-900">{grn.warehouse?.name || t("noValue")}</p>
              {grn.warehouse?.code && <p className="text-xs text-gray-500">{grn.warehouse.code}</p>}
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("businessUnit")}</Label>
              <p className="mt-1 text-sm font-medium text-gray-900">{grn.businessUnit?.name || t("noValue")}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("deliveryDate")}</Label>
                <p className="mt-1 text-sm font-medium text-gray-900">{formatDate(grn.deliveryDate)}</p>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("receivingDate")}</Label>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatDate(grn.receivingDate, t("notStarted"))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 pb-4">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                <User className="h-4 w-4 text-purple-600" />
              </div>
              <span className="font-semibold text-gray-900">{t("supplierPersonnel")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {grn.loadList?.supplier && (
              <div className="border-b border-gray-100 pb-4">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("supplier")}</Label>
                <p className="mt-1 text-sm font-semibold text-gray-900">{grn.loadList.supplier.name}</p>
                <p className="text-xs text-gray-500">{grn.loadList.supplier.code}</p>
              </div>
            )}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("createdBy")}</Label>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {grn.createdByUser
                  ? `${grn.createdByUser.firstName} ${grn.createdByUser.lastName}`
                  : t("noValue")}
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("receivedBy")}</Label>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {grn.receivedByUser
                  ? `${grn.receivedByUser.firstName} ${grn.receivedByUser.lastName}`
                  : t("noValue")}
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("checkedBy")}</Label>
              <p className="mt-1 text-sm font-medium text-gray-900">
                {grn.checkedByUser
                  ? `${grn.checkedByUser.firstName} ${grn.checkedByUser.lastName}`
                  : t("noValue")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="receive-items" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="receive-items">{t("receiveItemsTab")}</TabsTrigger>
          <TabsTrigger value="damage-items">{t("damageItemsTab")}</TabsTrigger>
          <TabsTrigger value="box-management">{t("boxManagementTab")}</TabsTrigger>
          <TabsTrigger value="notes">{t("notesTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="receive-items">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2.5 text-base">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
                      <Package className="h-4 w-4 text-indigo-600" />
                    </div>
                    <span className="font-semibold text-gray-900">{t("receivedItems")}</span>
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {isEditable
                      ? t("receiveItemsEditableDescription")
                      : t("receiveItemsReadonlyDescription")}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {t("itemsCount", { count: grn.items.length })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-200 bg-gray-50 hover:bg-gray-50">
                      <TableHead className="text-xs font-semibold text-gray-700">{t("itemCode")}</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-700">{t("itemName")}</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-gray-700">{t("expected")}</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-gray-700">{t("received")}</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-gray-700">{t("damaged")}</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-gray-700">{t("boxes")}</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-gray-700">{t("variance")}</TableHead>
                      <TableHead className="min-w-[200px] text-xs font-semibold text-gray-700">{t("notes")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grn.items.map((item, index) => {
                      const receivedQty = Number(getItemValue(item, "receivedQty")) || 0;
                      const variance = receivedQty - item.loadListQty;
                      const varianceClass =
                        variance > 0
                          ? "text-emerald-600 bg-emerald-50"
                          : variance < 0
                            ? "text-red-600 bg-red-50"
                            : "text-gray-600";

                      return (
                        <TableRow
                          key={item.id}
                          className={`border-b border-gray-100 ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"} transition-colors hover:bg-blue-50/50`}
                        >
                          <TableCell className="text-sm font-semibold text-gray-900">{item.item?.code || t("noValue")}</TableCell>
                          <TableCell className="text-sm text-gray-700">{item.item?.name || t("noValue")}</TableCell>
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
                                className="h-9 w-24 border-gray-300 text-right text-sm focus:border-indigo-500 focus:ring-indigo-500"
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
                                className="h-9 w-24 border-gray-300 text-right text-sm focus:border-red-500 focus:ring-red-500"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-900">
                                {getItemValue(item, "damagedQty")}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditable ? (
                              <Input
                                type="number"
                                min="0"
                                value={getItemValue(item, "numBoxes")}
                                onChange={(e) =>
                                  handleItemChange(item.id, "numBoxes", parseInt(e.target.value, 10) || 0)
                                }
                                className="h-9 w-24 border-gray-300 text-right text-sm focus:border-blue-500 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-900">
                                {getItemValue(item, "numBoxes")}
                              </span>
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
                                className="h-9 w-full border-gray-300 text-sm focus:border-purple-500 focus:ring-purple-500"
                                placeholder={t("addNotesPlaceholder")}
                              />
                            ) : (
                              <span className="text-sm text-gray-700">{getItemValue(item, "notes") || t("noValue")}</span>
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
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-yellow-50">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                  <Calendar className="h-4 w-4 text-amber-600" />
                </div>
                <span className="font-semibold text-gray-900">{t("additionalNotes")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {grn.notes ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{grn.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("approveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("approveDescription", { grnNumber: grn.grnNumber })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="approve-notes">{t("approvalNotes")}</Label>
            <Textarea
              id="approve-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("approvalNotesPlaceholder")}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveMutation.isPending ? t("approving") : t("approve")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rejectTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("rejectDescription", { grnNumber: grn.grnNumber })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">{t("rejectionReason")}</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("rejectionReasonPlaceholder")}
              rows={3}
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejectMutation.isPending ? t("rejecting") : t("reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
