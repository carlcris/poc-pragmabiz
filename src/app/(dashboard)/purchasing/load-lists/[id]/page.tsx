"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Package, Pencil, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLoadList, useUpdateLoadListStatus } from "@/hooks/useLoadLists";
import { useCurrency } from "@/hooks/useCurrency";
import { LinkStockRequisitionsDialog } from "@/components/load-lists/LinkStockRequisitionsDialog";
import type { LoadListStatus } from "@/types/load-list";

export default function LoadListDetailPage() {
  const t = useTranslations("loadListDetailPage");
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: ll, isLoading, error } = useLoadList(id);
  const updateStatusMutation = useUpdateLoadListStatus();
  const { formatCurrency } = useCurrency();

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [inTransitDialogOpen, setInTransitDialogOpen] = useState(false);
  const [arrivedDialogOpen, setArrivedDialogOpen] = useState(false);
  const [receivedDialogOpen, setReceivedDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [inTransitEstimatedArrivalDate, setInTransitEstimatedArrivalDate] = useState("");
  const [inTransitLinerName, setInTransitLinerName] = useState("");

  useEffect(() => {
    if (!ll || !inTransitDialogOpen) return;
    setInTransitEstimatedArrivalDate(ll.estimatedArrivalDate?.split("T")[0] || "");
    setInTransitLinerName(ll.linerName || "");
  }, [inTransitDialogOpen, ll]);

  const getStatusBadge = (status: LoadListStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">{t("draft")}</Badge>;
      case "confirmed":
        return (
          <Badge
            variant="outline"
            className="border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-400"
          >
            {t("confirmed")}
          </Badge>
        );
      case "in_transit":
        return (
          <Badge
            variant="outline"
            className="border-purple-600 text-purple-700 dark:border-purple-400 dark:text-purple-400"
          >
            {t("inTransit")}
          </Badge>
        );
      case "arrived":
        return (
          <Badge
            variant="outline"
            className="border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-400"
          >
            {t("arrived")}
          </Badge>
        );
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
      case "received":
        return (
          <Badge
            variant="outline"
            className="border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
          >
            {t("received")}
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">{t("cancelled")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleStatusChange = async (
    newStatus: LoadListStatus,
    dialogSetter: (open: boolean) => void
  ) => {
    try {
      await updateStatusMutation.mutateAsync({
        id,
        data: {
          status: newStatus,
        },
      });
      toast.success(
        t("statusUpdateSuccess", {
          status: t(
            newStatus === "in_transit"
              ? "inTransit"
              : newStatus === "pending_approval"
                ? "pendingApproval"
                : newStatus
          ),
        })
      );
      dialogSetter(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("statusUpdateError"));
    }
  };

  const handleMarkInTransit = async () => {
    try {
      await updateStatusMutation.mutateAsync({
        id,
        data: {
          status: "in_transit",
          estimatedArrivalDate: inTransitEstimatedArrivalDate || undefined,
          linerName: inTransitLinerName.trim() || undefined,
        },
      });
      toast.success(t("statusUpdateSuccess", { status: t("inTransit") }));
      setInTransitDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("statusUpdateError"));
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return t("noValue");
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "2-digit" }).format(new Date(dateString));
  };

  const formatUser = (user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }) => {
    if (!user) return t("noValue");
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    return fullName || user.email || t("noValue");
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground">{ll?.llNumber || id}</p>
          </div>
        </div>
        {ll && (
          <div className="flex flex-wrap items-center gap-2">
            {ll.status === "draft" && (
              <>
                <Button variant="outline" onClick={() => router.push(`?edit=true`)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("edit")}
                </Button>
                <Button onClick={() => setConfirmDialogOpen(true)}>{t("confirm")}</Button>
              </>
            )}
            {(ll.status === "confirmed" ||
              ll.status === "in_transit" ||
              ll.status === "arrived") && (
              <Button variant="outline" onClick={() => setLinkDialogOpen(true)}>
                <LinkIcon className="mr-2 h-4 w-4" />
                {t("linkStockRequisitions")}
              </Button>
            )}
            {ll.status === "confirmed" && (
              <Button onClick={() => setInTransitDialogOpen(true)}>{t("markInTransit")}</Button>
            )}
            {ll.status === "in_transit" && (
              <Button onClick={() => setArrivedDialogOpen(true)}>{t("markArrived")}</Button>
            )}
            {ll.status === "pending_approval" && (
              <Button onClick={() => setReceivedDialogOpen(true)}>{t("markReceived")}</Button>
            )}
            {ll.status !== "cancelled" && ll.status !== "received" && (
              <Button
                variant="destructive"
                onClick={() => setCancelDialogOpen(true)}
                disabled={updateStatusMutation.isPending}
              >
                {t("cancel")}
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded bg-muted" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {t("loadError")}
          </CardContent>
        </Card>
      ) : !ll ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("notFound")}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Header Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {t("detailsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">{t("status")}</span>
                    <div className="mt-1">{getStatusBadge(ll.status)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("supplier")}</span>
                    <div className="font-medium">
                      {ll.supplier?.name} ({ll.supplier?.code})
                    </div>
                    {ll.supplier?.contactPerson && (
                      <div className="text-xs text-muted-foreground">
                        {t("contact")} {ll.supplier.contactPerson}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("warehouse")}</span>
                    <div className="font-medium">
                      {ll.warehouse?.name} ({ll.warehouse?.code})
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("businessUnit")}</span>
                    <div className="font-medium">
                      {ll.businessUnit?.name || t("noValue")} ({ll.businessUnit?.code || t("noValue")})
                    </div>
                  </div>
                  {ll.supplierLlNumber && (
                    <div>
                      <span className="text-muted-foreground">{t("supplierLlNumber")}</span>
                      <div className="font-medium">{ll.supplierLlNumber}</div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground">{t("containerNumber")}</span>
                    <div className="font-medium">{ll.containerNumber || t("noValue")}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("sealNumber")}</span>
                    <div className="font-medium">{ll.sealNumber || t("noValue")}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("batchNumber")}</span>
                    <div className="font-medium">{ll.batchNumber || t("noValue")}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("linerName")}</span>
                    <div className="font-medium">{ll.linerName || t("noValue")}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("loadDate")}</span>
                    <div className="font-medium">{formatDate(ll.loadDate)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("estimatedArrival")}</span>
                    <div className="font-medium">{formatDate(ll.estimatedArrivalDate)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("actualArrival")}</span>
                    <div className="font-medium text-green-600">
                      {formatDate(ll.actualArrivalDate)}
                    </div>
                  </div>
                </div>
              </div>

              {ll.notes && (
                <div>
                  <span className="text-muted-foreground">{t("notes")}</span>
                  <div className="font-medium mt-1">{ll.notes}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground">{t("createdBy")}</span>
                    <div className="font-medium">{formatUser(ll.createdByUser)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(ll.createdAt)}</div>
                  </div>
                  {ll.receivedBy && (
                    <div>
                      <span className="text-muted-foreground">{t("receivedBy")}</span>
                      <div className="font-medium">{formatUser(ll.receivedByUser)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(ll.receivedDate)}
                      </div>
                    </div>
                  )}
                </div>
                {ll.approvedBy && (
                  <div>
                    <span className="text-muted-foreground">{t("approvedBy")}</span>
                    <div className="font-medium">{formatUser(ll.approvedByUser)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(ll.approvedDate)}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>{t("lineItems")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("itemCode")}</TableHead>
                      <TableHead>{t("itemName")}</TableHead>
                      <TableHead className="text-right">{t("loadListQty")}</TableHead>
                      <TableHead className="text-right">{t("receivedQty")}</TableHead>
                      <TableHead className="text-right">{t("damagedQty")}</TableHead>
                      <TableHead className="text-right">{t("shortageQty")}</TableHead>
                      <TableHead className="text-right">{t("unitPrice")}</TableHead>
                      <TableHead className="text-right">{t("total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ll.items && ll.items.length > 0 ? (
                      ll.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item?.code}</TableCell>
                          <TableCell>{item.item?.name}</TableCell>
                          <TableCell className="text-right">{item.loadListQty}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={item.receivedQty > 0 ? "text-green-600 font-medium" : ""}
                            >
                              {item.receivedQty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={item.damagedQty > 0 ? "text-red-600 font-medium" : ""}>
                              {item.damagedQty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={item.shortageQty > 0 ? "text-orange-600 font-medium" : ""}
                            >
                              {item.shortageQty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.totalPrice)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          {t("noLineItems")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange("confirmed", setConfirmDialogOpen)}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? t("confirming") : t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* In Transit Dialog */}
      <Dialog open={inTransitDialogOpen} onOpenChange={setInTransitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inTransitTitle")}</DialogTitle>
            <DialogDescription>{t("inTransitDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="load-list-estimated-arrival-date">
                {t("estimatedArrivalDateLabel")}
              </label>
              <Input
                id="load-list-estimated-arrival-date"
                type="date"
                value={inTransitEstimatedArrivalDate}
                onChange={(event) => setInTransitEstimatedArrivalDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="load-list-liner-name">
                {t("linerNameLabel")}
              </label>
              <Input
                id="load-list-liner-name"
                value={inTransitLinerName}
                onChange={(event) => setInTransitLinerName(event.target.value)}
                placeholder={t("linerNamePlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInTransitDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleMarkInTransit} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? t("updating") : t("saveAndMarkInTransit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Arrived Dialog */}
      <AlertDialog open={arrivedDialogOpen} onOpenChange={setArrivedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("arrivedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("arrivedDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange("arrived", setArrivedDialogOpen)}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? t("updating") : t("markArrived")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Received Dialog */}
      <AlertDialog open={receivedDialogOpen} onOpenChange={setReceivedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("receivedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("receivedDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange("received", setReceivedDialogOpen)}
              disabled={updateStatusMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {updateStatusMutation.isPending ? t("updating") : t("markReceived")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cancelDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancelBack")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusChange("cancelled", setCancelDialogOpen)}
              disabled={updateStatusMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {updateStatusMutation.isPending ? t("cancelling") : t("confirmCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link Stock Requisitions Dialog */}
      {ll && (
      <LinkStockRequisitionsDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        loadList={ll}
      />
      )}
    </div>
  );
}
