import { http, HttpResponse } from "msw";
import type {
  SalesOverview,
  SalesByTime,
  SalesByEmployee,
  SalesByLocation,
  DashboardWidgetData,
} from "@/types/analytics";
import { employees, salesDistributions } from "../data/employees";

export const analyticsHandlers = [
  // GET /api/analytics/sales/overview
  http.get("/api/analytics/sales/overview", ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate") || "2025-10-01";
    const endDate = url.searchParams.get("endDate") || "2025-10-31";

    const overview: SalesOverview = {
      totalSales: 1250000.0,
      totalCommissions: 62850.0,
      activeAgents: 8,
      averageOrderValue: 18250.0,
      transactionCount: 68,
      period: {
        startDate,
        endDate,
      },
      comparison: {
        previousPeriodSales: 1100000.0,
        salesGrowthPercentage: 13.64,
      },
    };

    return HttpResponse.json({
      data: overview,
      filters: { startDate, endDate },
      generatedAt: new Date().toISOString(),
    });
  }),

  // GET /api/analytics/sales/by-day
  http.get("/api/analytics/sales/by-day", ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate") || "2025-10-01";
    const endDate = url.searchParams.get("endDate") || "2025-10-31";

    // Generate mock data for the last 30 days
    const dailyData: SalesByTime[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= Math.min(daysDiff, 30); i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      dailyData.push({
        date: dateStr,
        sales: Math.random() * 100000 + 50000,
        transactions: Math.floor(Math.random() * 10) + 5,
        averageOrderValue: Math.random() * 10000 + 15000,
        commissions: Math.random() * 5000 + 2500,
      });
    }

    return HttpResponse.json({
      data: dailyData,
      pagination: {
        page: 1,
        limit: dailyData.length,
        total: dailyData.length,
        totalPages: 1,
      },
      filters: { startDate, endDate },
    });
  }),

  // GET /api/analytics/sales/by-employee
  http.get("/api/analytics/sales/by-employee", ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const salesAgents = employees.filter((e) => e.role === "sales_agent");

    const employeeData: SalesByEmployee[] = salesAgents.map((employee, index) => {
      const totalSales = Math.random() * 200000 + 100000;
      const transactionCount = Math.floor(Math.random() * 20) + 10;

      return {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        role: employee.role,
        territories: employee.city && employee.regionState
          ? [`${employee.city}, ${employee.regionState}`]
          : [],
        totalSales,
        totalCommission: totalSales * (employee.commissionRate / 100),
        transactionCount,
        averageOrderValue: totalSales / transactionCount,
        commissionRate: employee.commissionRate,
        rank: index + 1,
      };
    });

    // Sort by total sales descending
    employeeData.sort((a, b) => b.totalSales - a.totalSales);

    // Update ranks
    employeeData.forEach((data, index) => {
      data.rank = index + 1;
    });

    return HttpResponse.json({
      data: employeeData,
      pagination: {
        page: 1,
        limit: employeeData.length,
        total: employeeData.length,
        totalPages: 1,
      },
      filters: { startDate, endDate },
    });
  }),

  // GET /api/analytics/sales/by-location
  http.get("/api/analytics/sales/by-location", ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const locationData: SalesByLocation[] = [
      {
        city: "Davao City",
        regionState: "Davao Region",
        totalSales: 350000.0,
        transactionCount: 22,
        averageOrderValue: 15909.09,
        uniqueCustomers: 18,
        topEmployee: {
          id: "emp-003",
          name: "Juan Dela Cruz",
          sales: 145000.0,
        },
      },
      {
        city: "Cagayan de Oro City",
        regionState: "Northern Mindanao",
        totalSales: 280000.0,
        transactionCount: 18,
        averageOrderValue: 15555.56,
        uniqueCustomers: 15,
        topEmployee: {
          id: "emp-004",
          name: "Anna Reyes",
          sales: 167000.0,
        },
      },
      {
        city: "Zamboanga City",
        regionState: "Zamboanga Peninsula",
        totalSales: 210000.0,
        transactionCount: 12,
        averageOrderValue: 17500.0,
        uniqueCustomers: 10,
        topEmployee: {
          id: "emp-006",
          name: "Sofia Fernandez",
          sales: 210000.0,
        },
      },
      {
        city: "General Santos City",
        regionState: "SOCCSKSARGEN",
        totalSales: 180000.0,
        transactionCount: 10,
        averageOrderValue: 18000.0,
        uniqueCustomers: 8,
        topEmployee: {
          id: "emp-005",
          name: "Pedro Garcia",
          sales: 180000.0,
        },
      },
      {
        city: "Butuan City",
        regionState: "Caraga",
        totalSales: 120000.0,
        transactionCount: 7,
        averageOrderValue: 17142.86,
        uniqueCustomers: 6,
        topEmployee: {
          id: "emp-007",
          name: "Carlos Mendoza",
          sales: 120000.0,
        },
      },
    ];

    return HttpResponse.json({
      data: locationData,
      pagination: {
        page: 1,
        limit: locationData.length,
        total: locationData.length,
        totalPages: 1,
      },
      filters: { startDate, endDate },
    });
  }),

  // GET /api/analytics/sales/employee/:id
  http.get("/api/analytics/sales/employee/:employeeId", ({ params, request }) => {
    const { employeeId } = params;
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const employee = employees.find((e) => e.id === employeeId);

    if (!employee) {
      return new HttpResponse(null, { status: 404 });
    }

    const totalSales = Math.random() * 200000 + 100000;
    const transactionCount = Math.floor(Math.random() * 20) + 10;

    const employeeData: SalesByEmployee = {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      role: employee.role,
      territories: employee.city && employee.regionState
        ? [`${employee.city}, ${employee.regionState}`]
        : [],
      totalSales,
      totalCommission: totalSales * (employee.commissionRate / 100),
      transactionCount,
      averageOrderValue: totalSales / transactionCount,
      commissionRate: employee.commissionRate,
    };

    return HttpResponse.json({
      data: employeeData,
      filters: { startDate, endDate, employeeId: employeeId as string },
      generatedAt: new Date().toISOString(),
    });
  }),

  // GET /api/analytics/commissions/employee/:id
  http.get("/api/analytics/commissions/employee/:employeeId", ({ params, request }) => {
    const { employeeId } = params;
    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "2025-10";

    const employee = employees.find((e) => e.id === employeeId);

    if (!employee) {
      return new HttpResponse(null, { status: 404 });
    }

    const totalSales = Math.random() * 200000 + 100000;
    const totalCommission = totalSales * (employee.commissionRate / 100);

    return HttpResponse.json({
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      period,
      invoiceCount: Math.floor(Math.random() * 20) + 10,
      totalSales,
      totalCommission,
      paidCommission: totalCommission * 0.7,
      pendingCommission: totalCommission * 0.3,
      commissionRate: employee.commissionRate,
    });
  }),

  // GET /api/analytics/commissions/employee/:id/breakdown
  http.get("/api/analytics/commissions/employee/:employeeId/breakdown", ({ params, request }) => {
    const { employeeId } = params;
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const employee = employees.find((e) => e.id === employeeId);

    if (!employee) {
      return new HttpResponse(null, { status: 404 });
    }

    // Generate mock commission breakdown
    const breakdown = Array.from({ length: 10 }, (_, i) => {
      const amount = Math.random() * 30000 + 10000;
      return {
        invoiceId: `inv-${i + 1}`,
        invoiceCode: `INV-2025-${String(i + 1).padStart(4, "0")}`,
        date: new Date(2025, 9, i + 1).toISOString().split("T")[0],
        customerName: `Customer ${i + 1}`,
        totalAmount: amount,
        commissionAmount: amount * (employee.commissionRate / 100),
        commissionPercentage: employee.commissionRate,
        status: i % 3 === 0 ? "paid" : "pending",
        splitWith: i % 4 === 0 ? ["Other Agent"] : undefined,
      };
    });

    return HttpResponse.json(breakdown);
  }),

  // GET /api/analytics/dashboard/widgets
  http.get("/api/analytics/dashboard/widgets", () => {
    const widgetData: DashboardWidgetData = {
      todaysSales: {
        amount: 75000.0,
        growth: 12.5,
        transactions: 8,
      },
      mySales: {
        amount: 18000.0,
        transactions: 2,
        commission: 900.0,
        rank: 3,
      },
      topAgent: {
        employeeId: "emp-006",
        name: "Sofia Fernandez",
        sales: 210000.0,
        transactions: 12,
      },
      recentActivity: [
        {
          id: "1",
          time: "10:30 AM",
          customer: "ABC Corp",
          amount: 25000.0,
          agent: "Juan Dela Cruz",
          location: "Davao City",
        },
        {
          id: "2",
          time: "11:15 AM",
          customer: "XYZ Inc",
          amount: 18000.0,
          agent: "Anna Reyes",
          location: "Cagayan de Oro City",
        },
        {
          id: "3",
          time: "2:45 PM",
          customer: "Tech Solutions",
          amount: 32000.0,
          agent: "Sofia Fernandez",
          location: "Zamboanga City",
        },
      ],
    };

    return HttpResponse.json(widgetData);
  }),

  // POST /api/analytics/export
  http.post("/api/analytics/export", async ({ request }) => {
    const body = await request.json();

    // Return mock blob data for export
    const mockData = new Blob(["Mock export data"], { type: "application/octet-stream" });

    return new HttpResponse(mockData, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment; filename=analytics-export.xlsx",
      },
    });
  }),
];
