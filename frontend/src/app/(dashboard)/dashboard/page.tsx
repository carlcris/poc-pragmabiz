"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, AlertTriangle, FileText, ArrowUp, ArrowDown, ShoppingBag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/useCurrency";
import { useItems } from "@/hooks/useItems";
import { useSalesOrders } from "@/hooks/useSalesOrders";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useInvoices } from "@/hooks/useInvoices";
import { useCustomers } from "@/hooks/useCustomers";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useStockLevels } from "@/hooks/useReorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { TopAgentWidget } from "@/components/dashboard/top-agent-widget";
import { RecentActivityWidget } from "@/components/dashboard/recent-activity-widget";

export default function DashboardPage() {
  const { formatCurrency } = useCurrency();

  // Fetch data from all modules
  const { data: itemsData, isLoading: itemsLoading } = useItems();
  const { data: salesOrdersData, isLoading: salesOrdersLoading } = useSalesOrders();
  const { data: purchaseOrdersData, isLoading: purchaseOrdersLoading } = usePurchaseOrders();
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices();
  const { data: customersData, isLoading: customersLoading } = useCustomers();
  const { data: suppliersData, isLoading: suppliersLoading } = useSuppliers();
  const { data: stockLevelsData, isLoading: stockLevelsLoading } = useStockLevels();

  const isLoading = itemsLoading || salesOrdersLoading || purchaseOrdersLoading ||
                    invoicesLoading || customersLoading || suppliersLoading || stockLevelsLoading;

  const items = itemsData?.data || [];
  const salesOrders = salesOrdersData?.data || [];
  const purchaseOrders = purchaseOrdersData?.data || [];
  const invoices = invoicesData?.data || [];
  const customers = customersData?.data || [];
  const suppliers = suppliersData?.data || [];
  const stockLevels = stockLevelsData?.data || [];

  // Calculate statistics
  const totalRevenue = invoices
    .filter(inv => inv.status === "paid" || inv.status === "partially_paid")
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  const activeSalesOrders = salesOrders.filter(
    order => order.status !== "delivered" && order.status !== "cancelled"
  ).length;

  const activePurchaseOrders = purchaseOrders.filter(
    order => order.status !== "received" && order.status !== "cancelled"
  ).length;

  const activeCustomers = customers.filter(c => c.isActive).length;
  const activeSuppliers = suppliers.filter(s => s.status === "active").length;

  // Today's sales
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaysSales = salesOrders
    .filter(order => {
      const orderDate = new Date(order.orderDate);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    })
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
    .slice(0, 5);

  const todaysTotalSales = todaysSales.reduce((sum, order) => sum + order.totalAmount, 0);

  // Reorder point alerts - Use actual stock levels data
  const reorderAlerts = useMemo(() => {
    // Filter for items that are low_stock, critical, or out_of_stock
    return stockLevels
      .filter(level =>
        level.status === "low_stock" ||
        level.status === "critical" ||
        level.status === "out_of_stock"
      )
      .map(level => ({
        id: level.itemId,
        code: level.itemCode,
        name: level.itemName,
        currentStock: level.currentStock,
        reorderPoint: level.reorderPoint,
      }))
      .slice(0, 5);
  }, [stockLevels]);

  // Calculate product movement from sales orders
  const productMovement = useMemo(() => {
    const movement = new Map<string, { itemCode: string; itemName: string; totalQuantity: number }>();

    salesOrders.forEach(order => {
      order.lineItems.forEach(item => {
        const existing = movement.get(item.itemId);
        if (existing) {
          existing.totalQuantity += item.quantity;
        } else {
          movement.set(item.itemId, {
            itemCode: item.itemCode,
            itemName: item.itemName,
            totalQuantity: item.quantity,
          });
        }
      });
    });

    return Array.from(movement.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [salesOrders]);

  // Fast moving products (top 5)
  const fastMovingProducts = productMovement.slice(0, 5);

  // Slow moving products (bottom 5, excluding zero movement)
  const slowMovingProducts = productMovement.filter(p => p.totalQuantity > 0).slice(-5).reverse();

  const stats = [
    {
      title: "Total Revenue",
      value: formatCurrency(totalRevenue),
      description: `From ${invoices.length} invoices`,
      icon: TrendingUp,
      color: "text-orange-600",
    },
    {
      title: "Purchase Orders",
      value: activePurchaseOrders.toString(),
      description: "Pending/In-transit",
      icon: ShoppingBag,
      color: "text-purple-600",
    },
    {
      title: "Pending Invoices",
      value: invoices.filter(inv => inv.status === "pending").length.toString(),
      description: "Awaiting payment",
      icon: FileText,
      color: "text-yellow-600",
    },
    {
      title: "Low Stock Alerts",
      value: reorderAlerts.length.toString(),
      description: "Items need restocking",
      icon: AlertTriangle,
      color: "text-red-600",
    },
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      // Sales order/invoice statuses
      draft: { variant: "secondary", label: "Draft" },
      confirmed: { variant: "default", label: "Confirmed" },
      pending: { variant: "outline", label: "Pending" },
      paid: { variant: "default", label: "Paid" },
      partially_paid: { variant: "outline", label: "Partial" },
      overdue: { variant: "destructive", label: "Overdue" },
      // Purchase order statuses
      submitted: { variant: "outline", label: "Submitted" },
      approved: { variant: "default", label: "Approved" },
      in_transit: { variant: "outline", label: "In Transit" },
      partially_received: { variant: "outline", label: "Partial" },
      received: { variant: "default", label: "Received" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };
    const config = variants[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your business operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Sales Analytics Widgets */}
      <div className="grid gap-4 md:grid-cols-2">
        <TopAgentWidget />
        <RecentActivityWidget />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Today's Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Sales</CardTitle>
            <CardDescription>
              {isLoading ? (
                <Skeleton className="h-4 w-48" />
              ) : (
                `Sales orders from today • Total: ${formatCurrency(todaysTotalSales)}`
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : todaysSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sales today yet
              </p>
            ) : (
              <div className="space-y-4">
                {todaysSales.map((order) => (
                  <div key={order.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.customerName} • {format(new Date(order.orderDate), "h:mm a")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium">{formatCurrency(order.totalAmount)}</p>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>
                ))}
                <Link href="/sales/orders">
                  <Button variant="outline" className="w-full mt-2">
                    View All Orders
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reorder Point Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Reorder Point Alerts
            </CardTitle>
            <CardDescription>
              Items reaching reorder threshold
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Skeleton className="h-4 w-8 mb-1" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            ) : reorderAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                All items adequately stocked
              </p>
            ) : (
              <div className="space-y-3">
                {reorderAlerts.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.code}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-orange-600">{item.currentStock}</p>
                      <p className="text-xs text-muted-foreground">of {item.reorderPoint}</p>
                    </div>
                  </div>
                ))}
                <Link href="/inventory/items">
                  <Button variant="outline" className="w-full mt-2">
                    Manage Inventory
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Fast Moving Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-green-600" />
              Fast Moving Products
            </CardTitle>
            <CardDescription>
              Top selling products by quantity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : fastMovingProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sales data available
              </p>
            ) : (
              <div className="space-y-3">
                {fastMovingProducts.map((product, index) => (
                  <div key={product.itemCode} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{product.itemName}</p>
                      <p className="text-xs text-muted-foreground">{product.itemCode}</p>
                    </div>
                    <div className="text-sm font-bold text-green-600">
                      {product.totalQuantity} units
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Slow Moving Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDown className="h-5 w-5 text-orange-600" />
              Slow Moving Products
            </CardTitle>
            <CardDescription>
              Products with lowest sales
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : slowMovingProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sales data available
              </p>
            ) : (
              <div className="space-y-3">
                {slowMovingProducts.map((product, index) => (
                  <div key={product.itemCode} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{product.itemName}</p>
                      <p className="text-xs text-muted-foreground">{product.itemCode}</p>
                    </div>
                    <div className="text-sm font-bold text-orange-600">
                      {product.totalQuantity} units
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
