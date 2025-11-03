"use client";

import { useState } from "react";
import { Plus, Search, Pencil, Filter, Eye, FileText, CheckCircle, XCircle, Clock, Send } from "lucide-react";
import { useQuotations } from "@/hooks/useQuotations";
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
import { QuotationFormDialog } from "@/components/quotations/QuotationFormDialog";
import { useCurrency } from "@/hooks/useCurrency";
import type { Quotation, QuotationStatus } from "@/types/quotation";

export default function QuotationsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);

  const { formatCurrency } = useCurrency();

  const { data, isLoading, error } = useQuotations({
    search,
    page: 1,
    limit: 1000, // Get all for client-side filtering
  });

  // Apply client-side filters
  let filteredQuotations = data?.data || [];

  if (statusFilter !== "all") {
    filteredQuotations = filteredQuotations.filter(q => q.status === statusFilter);
  }

  // Calculate pagination
  const total = filteredQuotations.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const quotations = filteredQuotations.slice(start, end);

  const pagination = {
    total,
    page,
    limit: pageSize,
    totalPages,
  };

  const getStatusIcon = (status: QuotationStatus) => {
    switch (status) {
      case "draft":
        return <FileText className="h-4 w-4 text-gray-600" />;
      case "sent":
        return <Send className="h-4 w-4 text-blue-600" />;
      case "accepted":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "expired":
        return <Clock className="h-4 w-4 text-orange-600" />;
    }
  };

  const getStatusBadge = (status: QuotationStatus) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "sent":
        return <Badge variant="default" className="bg-blue-600">Sent</Badge>;
      case "accepted":
        return <Badge variant="default" className="bg-green-600">Accepted</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "expired":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Expired</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isExpiringSoon = (validUntil: string) => {
    const daysUntilExpiry = Math.ceil(
      (new Date(validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleCreateQuotation = () => {
    setSelectedQuotation(null);
    setDialogOpen(true);
  };

  const handleEditQuotation = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>
          <p className="text-muted-foreground">
            Create and manage sales quotations
          </p>
        </div>
        <Button onClick={handleCreateQuotation}>
          <Plus className="mr-2 h-4 w-4" />
          Create Quotation
        </Button>
      </div>

      <div className="space-y-4">
        <div className="mb-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quotations..."
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
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Error loading quotations. Please try again.
            </div>
          ) : quotations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No quotations found. Create your first quotation to get started.
            </div>
          ) : (
            <>
              <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Quotation #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotations.map((quotation) => (
                      <TableRow key={quotation.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(quotation.status)}
                            {quotation.quotationNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{quotation.customerName}</div>
                          <div className="text-xs text-muted-foreground">{quotation.customerEmail}</div>
                        </TableCell>
                        <TableCell>
                          {formatDate(quotation.quotationDate)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {formatDate(quotation.validUntil)}
                            {isExpiringSoon(quotation.validUntil) && quotation.status === "sent" && (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                                Expiring Soon
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{formatCurrency(quotation.totalAmount)}</div>
                          <div className="text-xs text-muted-foreground">
                            {quotation.lineItems.length} item{quotation.lineItems.length !== 1 ? "s" : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(quotation.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(quotation.status === "draft" || quotation.status === "sent") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditQuotation(quotation)}
                              >
                                <Pencil className="h-4 w-4" />
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

      <QuotationFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        quotation={selectedQuotation}
      />
    </div>
  );
}
