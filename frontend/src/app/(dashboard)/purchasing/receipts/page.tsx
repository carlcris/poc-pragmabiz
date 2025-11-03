"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Search, Download, Package, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";

// Mock data for goods receipts
const mockReceipts = [
  {
    id: "GR-2024-001",
    purchaseOrderId: "PO-2024-156",
    supplier: "ABC Distributors Inc.",
    receiptDate: "2024-01-15",
    items: 5,
    totalQuantity: 250,
    status: "completed",
    receivedBy: "John Doe",
  },
  {
    id: "GR-2024-002",
    purchaseOrderId: "PO-2024-157",
    supplier: "XYZ Supplies Co.",
    receiptDate: "2024-01-14",
    items: 3,
    totalQuantity: 120,
    status: "partial",
    receivedBy: "Jane Smith",
  },
  {
    id: "GR-2024-003",
    purchaseOrderId: "PO-2024-158",
    supplier: "Global Parts Ltd.",
    receiptDate: "2024-01-14",
    items: 8,
    totalQuantity: 400,
    status: "pending",
    receivedBy: "Mike Johnson",
  },
  {
    id: "GR-2024-004",
    purchaseOrderId: "PO-2024-159",
    supplier: "Quality Products Inc.",
    receiptDate: "2024-01-13",
    items: 2,
    totalQuantity: 80,
    status: "completed",
    receivedBy: "Sarah Wilson",
  },
];

const statusConfig = {
  completed: {
    label: "Completed",
    variant: "default" as const,
    icon: CheckCircle,
    color: "text-green-600",
  },
  partial: {
    label: "Partial",
    variant: "secondary" as const,
    icon: Clock,
    color: "text-yellow-600",
  },
  pending: {
    label: "Pending",
    variant: "outline" as const,
    icon: Clock,
    color: "text-gray-600",
  },
};

export default function GoodsReceiptsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredReceipts = mockReceipts.filter((receipt) => {
    const matchesSearch =
      receipt.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.purchaseOrderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || receipt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage);
  const paginatedReceipts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredReceipts.slice(startIndex, endIndex);
  }, [filteredReceipts, currentPage]);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Goods Receipts</h1>
          <p className="text-muted-foreground">
            Manage incoming inventory and goods receipts
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Receipt
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockReceipts.length}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockReceipts.filter((r) => r.status === "completed").length}
            </div>
            <p className="text-xs text-muted-foreground">Fully received</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partial</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockReceipts.filter((r) => r.status === "partial").length}
            </div>
            <p className="text-xs text-muted-foreground">Partially received</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockReceipts.filter((r) => r.status === "pending").length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting receipt</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by receipt ID, PO number, or supplier..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Receipts Table */}
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt ID</TableHead>
                <TableHead>Purchase Order</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Receipt Date</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedReceipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No goods receipts found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedReceipts.map((receipt) => {
                  const status = statusConfig[receipt.status];
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-medium">{receipt.id}</TableCell>
                      <TableCell>
                        <span className="text-sm text-blue-600 hover:underline cursor-pointer">
                          {receipt.purchaseOrderId}
                        </span>
                      </TableCell>
                      <TableCell>{receipt.supplier}</TableCell>
                      <TableCell>
                        {new Date(receipt.receiptDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">{receipt.items}</TableCell>
                      <TableCell className="text-right">{receipt.totalQuantity}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className={`h-3 w-3 ${status.color}`} />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{receipt.receivedBy}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/purchasing/receipts/${receipt.id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {filteredReceipts.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredReceipts.length)} of {filteredReceipts.length} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
