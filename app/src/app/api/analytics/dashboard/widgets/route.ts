/**
 * Dashboard Widgets API
 *
 * Endpoint:
 * - GET /api/analytics/dashboard/widgets - Get dashboard widget data
 */

import { NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import type { DashboardWidgetData } from "@/types/analytics";

/**
 * GET /api/analytics/dashboard/widgets
 * Get dashboard widget data including today's sales, top agent, and recent activity
 */
export async function GET() {
  try {
    const { supabase } = await createServerClientWithBU();

    // Get current user and company
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: companyError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (companyError || !userData?.company_id) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyId = userData.company_id;
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Get today's sales from ALL sources

    // 1. POS Transactions
    const { data: todayPOSTransactions } = await supabase
      .from("pos_transactions")
      .select("total_amount, created_at")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59`);

    // 2. Sales Invoices (paid or posted)
    const { data: todayInvoices } = await supabase
      .from("sales_invoices")
      .select("total_amount, created_at")
      .eq("company_id", companyId)
      .in("status", ["paid", "posted"])
      .gte("invoice_date", today)
      .lte("invoice_date", today);

    // Get yesterday's sales for growth calculation

    // 1. Yesterday's POS
    const { data: yesterdayPOSTransactions } = await supabase
      .from("pos_transactions")
      .select("total_amount")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", `${yesterday}T00:00:00`)
      .lt("created_at", `${yesterday}T23:59:59`);

    // 2. Yesterday's Invoices
    const { data: yesterdayInvoices } = await supabase
      .from("sales_invoices")
      .select("total_amount")
      .eq("company_id", companyId)
      .in("status", ["paid", "posted"])
      .gte("invoice_date", yesterday)
      .lte("invoice_date", yesterday);

    // Calculate totals from all sources
    const todayPOSAmount = todayPOSTransactions?.reduce((sum, t) => sum + Number(t.total_amount), 0) || 0;
    const todayInvoiceAmount = todayInvoices?.reduce((sum, t) => sum + Number(t.total_amount), 0) || 0;
    const todayAmount = todayPOSAmount + todayInvoiceAmount;

    const yesterdayPOSAmount = yesterdayPOSTransactions?.reduce((sum, t) => sum + Number(t.total_amount), 0) || 0;
    const yesterdayInvoiceAmount = yesterdayInvoices?.reduce((sum, t) => sum + Number(t.total_amount), 0) || 0;
    const yesterdayAmount = yesterdayPOSAmount + yesterdayInvoiceAmount;

    const growth = yesterdayAmount > 0 ? ((todayAmount - yesterdayAmount) / yesterdayAmount) * 100 : 0;

    const todayTransactionCount = (todayPOSTransactions?.length || 0) + (todayInvoices?.length || 0);

    // Get top agent (user with most sales today from all sources)

    // Aggregate sales by user from POS
    const posSalesByUser = new Map<string, { name: string; sales: number; transactions: number }>();
    if (todayPOSTransactions) {
      for (const transaction of todayPOSTransactions) {
        const userId = (transaction as any).created_by;
        if (!posSalesByUser.has(userId)) {
          posSalesByUser.set(userId, { name: '', sales: 0, transactions: 0 });
        }
        const userData = posSalesByUser.get(userId)!;
        userData.sales += Number(transaction.total_amount);
        userData.transactions += 1;
      }
    }

    // Aggregate sales by employee from Invoices
    const { data: invoicesByEmployee } = await supabase
      .from("sales_invoices")
      .select(`
        primary_employee_id,
        total_amount,
        employees!sales_invoices_primary_employee_id_fkey (
          id,
          users!employees_user_id_fkey (
            id,
            first_name,
            last_name
          )
        )
      `)
      .eq("company_id", companyId)
      .in("status", ["paid", "posted"])
      .gte("invoice_date", today)
      .lte("invoice_date", today)
      .not("primary_employee_id", "is", null);

    // Aggregate invoice sales by user
    const invoiceSalesByUser = new Map<string, { name: string; sales: number; transactions: number }>();
    if (invoicesByEmployee) {
      for (const invoice of invoicesByEmployee) {
        const employee = (invoice.employees as any);
        if (employee && employee.users) {
          const userId = employee.users.id;
          const userName = `${employee.users.first_name} ${employee.users.last_name}`;
          if (!invoiceSalesByUser.has(userId)) {
            invoiceSalesByUser.set(userId, { name: userName, sales: 0, transactions: 0 });
          }
          const userData = invoiceSalesByUser.get(userId)!;
          userData.sales += Number(invoice.total_amount);
          userData.transactions += 1;
        }
      }
    }

    // Merge both sources and find top agent
    const allSalesByUser = new Map<string, { name: string; sales: number; transactions: number }>();

    for (const [userId, data] of posSalesByUser) {
      allSalesByUser.set(userId, data);
    }

    for (const [userId, data] of invoiceSalesByUser) {
      if (allSalesByUser.has(userId)) {
        const existing = allSalesByUser.get(userId)!;
        existing.sales += data.sales;
        existing.transactions += data.transactions;
        existing.name = data.name; // Use name from invoice if available
      } else {
        allSalesByUser.set(userId, data);
      }
    }

    // Find top agent
    let topAgent = {
      employeeId: "",
      name: "No sales yet",
      sales: 0,
      transactions: 0,
    };

    let maxSales = 0;
    let topUserId = "";
    for (const [userId, data] of allSalesByUser) {
      if (data.sales > maxSales) {
        maxSales = data.sales;
        topUserId = userId;
      }
    }

    if (topUserId && allSalesByUser.has(topUserId)) {
      const topUserData = allSalesByUser.get(topUserId)!;

      // Get user name if not already set
      let userName = topUserData.name;
      if (!userName) {
        const { data: userData } = await supabase
          .from("users")
          .select("first_name, last_name")
          .eq("id", topUserId)
          .single();

        if (userData) {
          userName = `${userData.first_name} ${userData.last_name}`;
        }
      }

      topAgent = {
        employeeId: topUserId,
        name: userName || "Unknown",
        sales: topUserData.sales,
        transactions: topUserData.transactions,
      };
    }

    // Get recent activity from all sources (last 5 transactions combined)

    // 1. Get recent POS transactions
    const { data: recentPOSTransactions } = await supabase
      .from("pos_transactions")
      .select(`
        id,
        transaction_code,
        total_amount,
        created_at,
        customers (
          customer_name
        ),
        users!pos_transactions_created_by_fkey (
          first_name,
          last_name
        )
      `)
      .eq("company_id", companyId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(10);

    // 2. Get recent Sales Invoices
    const { data: recentInvoices } = await supabase
      .from("sales_invoices")
      .select(`
        id,
        invoice_code,
        total_amount,
        invoice_date,
        created_at,
        customers:customer_id (
          customer_name
        ),
        employees:primary_employee_id (
          users:user_id (
            first_name,
            last_name
          )
        ),
        warehouses:warehouse_id (
          warehouse_name
        )
      `)
      .eq("company_id", companyId)
      .in("status", ["paid", "posted"])
      .order("created_at", { ascending: false })
      .limit(10);

    // Combine and sort all recent activity
    const allRecentActivity: Array<{
      id: string;
      time: string;
      customer: string;
      amount: number;
      agent: string;
      location: string;
      timestamp: Date;
    }> = [];

    // Add POS transactions
    if (recentPOSTransactions) {
      for (const t of recentPOSTransactions) {
        allRecentActivity.push({
          id: t.id,
          time: new Date(t.created_at).toLocaleTimeString(),
          customer: t.customers ? (t.customers as any).customer_name : "Walk-in Customer",
          amount: Number(t.total_amount),
          agent: t.users ? `${(t.users as any).first_name} ${(t.users as any).last_name}` : "Unknown",
          location: "POS",
          timestamp: new Date(t.created_at),
        });
      }
    }

    // Add Invoice transactions
    if (recentInvoices) {
      for (const inv of recentInvoices) {
        const employee = (inv.employees as any);
        const agentName = employee && employee.users
          ? `${employee.users.first_name} ${employee.users.last_name}`
          : "Unknown";

        const warehouse = (inv.warehouses as any);
        const locationName = warehouse?.warehouse_name || "Invoice";

        allRecentActivity.push({
          id: inv.id,
          time: new Date(inv.created_at).toLocaleTimeString(),
          customer: inv.customers ? (inv.customers as any).customer_name : "Unknown Customer",
          amount: Number(inv.total_amount),
          agent: agentName,
          location: locationName,
          timestamp: new Date(inv.created_at),
        });
      }
    }

    // Sort by timestamp descending and take top 5
    allRecentActivity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const recentActivity = allRecentActivity.slice(0, 5).map(({ timestamp, ...rest }) => rest);

    // Get reorder alerts - items with stock below reorder level
    const { data: reorderAlertsData, error: reorderAlertsError } = await supabase
      .from("item_warehouse")
      .select(`
        item_id,
        warehouse_id,
        current_stock,
        reorder_level,
        items!inner (
          id,
          item_code,
          item_name,
          company_id
        )
      `)
      .eq("items.company_id", companyId)
      .not("reorder_level", "is", null)
      .order("current_stock", { ascending: true })
      .limit(100);

    if (reorderAlertsError) {
      console.error("Error fetching reorder alerts:", reorderAlertsError);
    }

    // Filter alerts where current stock is below reorder level and sort
    const reorderAlerts = (reorderAlertsData || [])
      .filter((alert: any) => {
        const currentStock = parseFloat(alert.current_stock) || 0;
        const reorderLevel = parseFloat(alert.reorder_level) || 0;
        return currentStock < reorderLevel;
      })
      .sort((a: any, b: any) => {
        const aStock = parseFloat(a.current_stock) || 0;
        const bStock = parseFloat(b.current_stock) || 0;
        return aStock - bStock;
      })
      .slice(0, 10)
      .map((alert: any) => ({
        id: alert.item_id,
        code: alert.items.item_code,
        name: alert.items.item_name,
        currentStock: parseFloat(alert.current_stock) || 0,
        reorderPoint: parseFloat(alert.reorder_level) || 0,
        warehouseId: alert.warehouse_id,
      }));

    // Get statistics
    const { data: salesOrdersData } = await supabase
      .from("sales_orders")
      .select("id, status")
      .eq("company_id", companyId)
      .is("deleted_at", null);

    const activeSalesOrders = (salesOrdersData || []).filter(
      (order: any) => order.status !== "delivered" && order.status !== "cancelled"
    ).length;

    const { data: purchaseOrdersData } = await supabase
      .from("purchase_orders")
      .select("id, status")
      .eq("company_id", companyId)
      .is("deleted_at", null);

    const activePurchaseOrders = (purchaseOrdersData || []).filter(
      (order: any) => order.status === "pending" || order.status === "in_transit"
    ).length;

    const widgetData: DashboardWidgetData = {
      todaysSales: {
        amount: todayAmount,
        growth: growth,
        transactions: todayTransactionCount,
      },
      topAgent,
      recentActivity,
      reorderAlerts,
      stats: {
        activeSalesOrders,
        activePurchaseOrders,
        lowStockCount: reorderAlerts.length,
      },
    };

    return NextResponse.json(widgetData);
  } catch (error) {
    console.error("Unexpected error in GET /api/analytics/dashboard/widgets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
