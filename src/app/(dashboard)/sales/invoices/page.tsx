"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle,
  DollarSign,
  Eye,
  FileText,
  Filter,
  Pencil,
  Plus,
  Printer,
  Search,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  useInvoices,
  useSendInvoice,
  useCancelInvoice,
  useDeleteInvoice,
} from "@/hooks/useInvoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { useCurrency } from "@/hooks/useCurrency";
import type { Invoice, InvoiceStatus } from "@/types/invoice";

const InvoiceFormDialog = dynamic(
  () => import("@/components/invoices/InvoiceFormDialog").then((mod) => mod.InvoiceFormDialog),
  { ssr: false }
);
const RecordPaymentDialog = dynamic(
  () => import("@/components/invoices/RecordPaymentDialog").then((mod) => mod.RecordPaymentDialog),
  { ssr: false }
);
const InvoiceViewDialog = dynamic(
  () => import("@/components/invoices/InvoiceViewDialog").then((mod) => mod.InvoiceViewDialog),
  { ssr: false }
);

export default function InvoicesPage() {
  const t = useTranslations("invoicesPage");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToSend, setInvoiceToSend] = useState<Invoice | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  const { formatCurrency } = useCurrency();
  const sendInvoice = useSendInvoice({ success: t("sendSuccess"), error: t("sendError") });
  const cancelInvoice = useCancelInvoice({ success: t("cancelSuccess"), error: t("cancelError") });
  const deleteInvoice = useDeleteInvoice({ success: t("deleteSuccess"), error: t("deleteError") });

  const { data, isLoading, error } = useInvoices({
    search,
    status: statusFilter as InvoiceStatus | "all",
    page,
    limit: pageSize,
  });

  const invoices = data?.data || [];
  const pagination = data?.pagination;

  const getStatusIcon = (status: InvoiceStatus) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4 text-gray-600" />;
      case "sent":
        return <Send className="h-4 w-4 text-blue-600" />;
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "partially_paid":
        return <DollarSign className="h-4 w-4 text-yellow-600" />;
      case "overdue":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">{t("draft")}</Badge>;
      case "sent":
        return <Badge className="bg-blue-600">{t("sent")}</Badge>;
      case "paid":
        return <Badge className="bg-green-600">{t("paidStatus")}</Badge>;
      case "partially_paid":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{t("partiallyPaid")}</Badge>;
      case "overdue":
        return <Badge variant="destructive">{t("overdueStatus")}</Badge>;
      case "cancelled":
        return <Badge variant="secondary">{t("cancelledStatus")}</Badge>;
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const isOverdue = (dueDate: string, status: InvoiceStatus) => {
    if (status === "paid" || status === "cancelled") return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => { setSelectedInvoice(null); setFormDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createInvoice")}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder={t("statusPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatus")}</SelectItem>
              <SelectItem value="draft">{t("draft")}</SelectItem>
              <SelectItem value="sent">{t("sent")}</SelectItem>
              <SelectItem value="paid">{t("paidStatus")}</SelectItem>
              <SelectItem value="partially_paid">{t("partiallyPaid")}</SelectItem>
              <SelectItem value="overdue">{t("overdueStatus")}</SelectItem>
              <SelectItem value="cancelled">{t("cancelledStatus")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">{t("loadError")}</div>
        ) : invoices.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("empty")}</div>
        ) : (
          <>
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>{t("invoiceNumber")}</TableHead>
                    <TableHead>{t("customer")}</TableHead>
                    <TableHead>{t("invoiceDate")}</TableHead>
                    <TableHead>{t("dueDate")}</TableHead>
                    <TableHead className="text-right">{t("amount")}</TableHead>
                    <TableHead className="text-right">{t("paid")}</TableHead>
                    <TableHead className="text-right">{t("due")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(invoice.status)}
                          {invoice.invoiceNumber}
                        </div>
                        {invoice.salesOrderNumber && (
                          <div className="mt-1 text-xs text-muted-foreground">{t("fromSalesOrder", { number: invoice.salesOrderNumber })}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{invoice.customerName}</div>
                        <div className="text-xs text-muted-foreground">{invoice.customerEmail}</div>
                      </TableCell>
                      <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {formatDate(invoice.dueDate)}
                          {isOverdue(invoice.dueDate, invoice.status) && (
                            <Badge variant="secondary" className="bg-red-100 text-xs text-red-800">{t("overdue")}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{formatCurrency(invoice.totalAmount)}</div>
                        <div className="text-xs text-muted-foreground">{t("itemsCount", { count: invoice.lineItems.length })}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium text-green-600">{formatCurrency(invoice.amountPaid)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`font-medium ${invoice.amountDue > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                          {formatCurrency(invoice.amountDue)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedInvoice(invoice); setViewDialogOpen(true); }} title={t("view")}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedInvoice(invoice); setViewDialogOpen(true); setTimeout(() => window.print(), 300); }} title={t("printInvoice")} className="text-gray-600 hover:text-gray-700">
                            <Printer className="h-4 w-4" />
                          </Button>
                          {invoice.status === "draft" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedInvoice(invoice); setFormDialogOpen(true); }} title={t("edit")}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { setInvoiceToSend(invoice); setSendDialogOpen(true); }} title={t("sendToCustomer")} className="text-blue-600 hover:text-blue-700">
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { setInvoiceToDelete(invoice); setDeleteDialogOpen(true); }} title={t("deleteInvoice")} className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {(["sent", "partially_paid", "overdue"] as InvoiceStatus[]).includes(invoice.status) && (
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedInvoice(invoice); setPaymentDialogOpen(true); }} title={t("recordPayment")} className="text-green-600 hover:text-green-700">
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          )}
                          {invoice.status !== "draft" && invoice.status !== "paid" && invoice.status !== "cancelled" && (
                            <Button variant="ghost" size="sm" onClick={() => { setInvoiceToCancel(invoice); setCancelDialogOpen(true); }} title={t("cancelInvoice")} className="text-orange-600 hover:text-orange-700">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {pagination && pagination.total > 0 && (
              <div className="mt-4">
                <DataTablePagination
                  currentPage={page}
                  totalPages={pagination.totalPages}
                  pageSize={pageSize}
                  totalItems={pagination.total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </>
        )}
      </div>

      {viewDialogOpen && <InvoiceViewDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} invoice={selectedInvoice} />}
      {formDialogOpen && <InvoiceFormDialog open={formDialogOpen} onOpenChange={setFormDialogOpen} invoice={selectedInvoice} />}
      {paymentDialogOpen && <RecordPaymentDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen} invoice={selectedInvoice} />}

      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sendTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {invoiceToSend && t("sendDescription", { invoiceNumber: invoiceToSend.invoiceNumber, customerName: invoiceToSend.customerName })}
              <br />
              <br />
              {t("sendDescriptionBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (!invoiceToSend) return; try { await sendInvoice.mutateAsync(invoiceToSend.id); setSendDialogOpen(false); setInvoiceToSend(null); } catch {} }} className="bg-blue-600 hover:bg-blue-700" disabled={sendInvoice.isPending}>
              {sendInvoice.isPending ? t("sending") : t("sendAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {invoiceToCancel && t("cancelDescription", { invoiceNumber: invoiceToCancel.invoiceNumber })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (!invoiceToCancel) return; try { await cancelInvoice.mutateAsync(invoiceToCancel.id); setCancelDialogOpen(false); setInvoiceToCancel(null); } catch {} }} className="bg-orange-600 hover:bg-orange-700" disabled={cancelInvoice.isPending}>
              {cancelInvoice.isPending ? t("cancelling") : t("cancelAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {invoiceToDelete && t("deleteDescription", { invoiceNumber: invoiceToDelete.invoiceNumber })}
              {invoiceToDelete?.salesOrderId && (
                <>
                  <br />
                  <br />
                  {t("deleteLinkedSalesOrderNotice")}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (!invoiceToDelete) return; try { await deleteInvoice.mutateAsync(invoiceToDelete.id); setDeleteDialogOpen(false); setInvoiceToDelete(null); } catch {} }} className="bg-red-600 hover:bg-red-700" disabled={deleteInvoice.isPending}>
              {deleteInvoice.isPending ? t("deleting") : t("deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
