"use client";

import { useState } from "react";
import { Plus, Search, Pencil, Filter, Eye, FileText, CheckCircle, Clock, Send, XCircle, AlertCircle, DollarSign, Printer } from "lucide-react";
import { useInvoices, useSendInvoice, useCancelInvoice, useDeleteInvoice } from "@/hooks/useInvoices";
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
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { InvoiceFormDialog } from "@/components/invoices/InvoiceFormDialog";
import { RecordPaymentDialog } from "@/components/invoices/RecordPaymentDialog";
import { InvoiceViewDialog } from "@/components/invoices/InvoiceViewDialog";
import { useCurrency } from "@/hooks/useCurrency";
import type { Invoice, InvoiceStatus } from "@/types/invoice";

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const { formatCurrency } = useCurrency();
  const sendInvoice = useSendInvoice();
  const cancelInvoice = useCancelInvoice();
  const deleteInvoice = useDeleteInvoice();

  const { data, isLoading, error } = useInvoices({
    search,
    page: 1,
    limit: 1000, // Get all for client-side filtering
  });

  // Apply client-side filters
  let filteredInvoices = data?.data || [];

  if (statusFilter !== "all") {
    filteredInvoices = filteredInvoices.filter(inv => inv.status === statusFilter);
  }

  // Calculate pagination
  const total = filteredInvoices.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const invoices = filteredInvoices.slice(start, end);

  const pagination = {
    total,
    page,
    limit: pageSize,
    totalPages,
  };

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
        return <Badge variant="secondary">Draft</Badge>;
      case "sent":
        return <Badge variant="default" className="bg-blue-600">Sent</Badge>;
      case "paid":
        return <Badge variant="default" className="bg-green-600">Paid</Badge>;
      case "partially_paid":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Partially Paid</Badge>;
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isOverdue = (dueDate: string, status: InvoiceStatus) => {
    if (status === "paid" || status === "cancelled") return false;
    return new Date(dueDate) < new Date();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleCreateInvoice = () => {
    setSelectedInvoice(null);
    setFormDialogOpen(true);
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setViewDialogOpen(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setFormDialogOpen(true);
  };

  const handleRecordPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentDialogOpen(true);
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setViewDialogOpen(true);
    // Delay print to ensure dialog is rendered
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleSendInvoice = async (id: string) => {
    if (confirm("Are you sure you want to send this invoice to the customer?")) {
      await sendInvoice.mutateAsync(id);
    }
  };

  const handleCancelInvoice = async (id: string) => {
    if (confirm("Are you sure you want to cancel this invoice? This action cannot be undone.")) {
      await cancelInvoice.mutateAsync(id);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) {
      await deleteInvoice.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Create and manage sales invoices
          </p>
        </div>
        <Button onClick={handleCreateInvoice}>
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Error loading invoices. Please try again.
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invoices found. Create your first invoice to get started.
            </div>
          ) : (
            <>
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Invoice Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
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
                            <div className="text-xs text-muted-foreground mt-1">
                              From {invoice.salesOrderNumber}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{invoice.customerName}</div>
                          <div className="text-xs text-muted-foreground">{invoice.customerEmail}</div>
                        </TableCell>
                        <TableCell>
                          {formatDate(invoice.invoiceDate)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {formatDate(invoice.dueDate)}
                            {isOverdue(invoice.dueDate, invoice.status) && (
                              <Badge variant="secondary" className="bg-red-100 text-red-800 text-xs">
                                Overdue
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{formatCurrency(invoice.totalAmount)}</div>
                          <div className="text-xs text-muted-foreground">
                            {invoice.lineItems.length} item{invoice.lineItems.length !== 1 ? "s" : ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium text-green-600">
                            {formatCurrency(invoice.amountPaid)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`font-medium ${invoice.amountDue > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                            {formatCurrency(invoice.amountDue)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(invoice.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewInvoice(invoice)}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePrintInvoice(invoice)}
                              title="Print Invoice"
                              className="text-gray-600 hover:text-gray-700"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            {invoice.status === "draft" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditInvoice(invoice)}
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSendInvoice(invoice.id)}
                                  title="Send to Customer"
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {(invoice.status === "sent" || invoice.status === "partially_paid" || invoice.status === "overdue") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRecordPayment(invoice)}
                                title="Record Payment"
                                className="text-green-600 hover:text-green-700"
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            )}
                            {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelInvoice(invoice.id)}
                                title="Cancel Invoice"
                                className="text-red-600 hover:text-red-700"
                              >
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

      <InvoiceViewDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        invoice={selectedInvoice}
      />

      <InvoiceFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        invoice={selectedInvoice}
      />

      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={selectedInvoice}
      />
    </div>
  );
}
