"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChefHat, Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type ManufacturingOrder = {
  id: string;
  manufacturingOrderCode: string;
  salesOrderCode: string;
  customerName: string;
  itemSummary: string;
  status: string;
  priority: string;
  dueDate: string | null;
  currentWorkstationName: string;
  activeOperation: { name: string; status: string } | null;
  materialCount: number;
  hasMaterialShortage: boolean;
};

type ManufacturingOrdersResponse = {
  data: ManufacturingOrder[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

const fetchManufacturingOrders = async (
  search: string,
  status: string
): Promise<ManufacturingOrdersResponse> => {
  const params = new URLSearchParams({ page: "1", limit: "50" });
  if (search.trim()) params.set("search", search.trim());
  if (status !== "all") params.set("status", status);

  const response = await fetch(`/api/manufacturing/orders?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Failed to load orders");
  }

  return response.json() as Promise<ManufacturingOrdersResponse>;
};

const labelize = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const getStatusBadge = (status: string) => {
  if (status === "completed") return <Badge className="bg-green-600">Completed</Badge>;
  if (status === "in_progress") return <Badge>In progress</Badge>;
  if (status === "on_hold") return <Badge variant="destructive">On hold</Badge>;
  if (status === "quality_check") return <Badge variant="secondary">Quality check</Badge>;
  return <Badge variant="outline">{labelize(status)}</Badge>;
};

export default function ManufacturingOrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["manufacturing-orders", search, status],
    queryFn: () => fetchManufacturingOrders(search, status),
  });

  const orders = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Plan and monitor production work from sales orders.
          </p>
        </div>
        <Button asChild>
          <Link href="/manufacturing/floor">
            <ChefHat className="mr-2 h-4 w-4" />
            Production
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order..."
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[190px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="on_hold">On hold</SelectItem>
            <SelectItem value="quality_check">Quality check</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Sales order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Work</TableHead>
              <TableHead>Station</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Loading orders...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-destructive">
                  {error instanceof Error ? error.message : "Failed to load orders"}
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.manufacturingOrderCode}</TableCell>
                  <TableCell>{order.salesOrderCode || "-"}</TableCell>
                  <TableCell>{order.customerName || "-"}</TableCell>
                  <TableCell>
                    <div>{order.itemSummary}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.activeOperation?.name || "No active operation"}
                    </div>
                  </TableCell>
                  <TableCell>{order.currentWorkstationName || "-"}</TableCell>
                  <TableCell>{formatDate(order.dueDate)}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-right">
                    {order.status !== "completed" && order.status !== "cancelled" ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/manufacturing/floor?focus=${order.id}`}>
                          <ChefHat className="mr-2 h-4 w-4" />
                          Open Production
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
