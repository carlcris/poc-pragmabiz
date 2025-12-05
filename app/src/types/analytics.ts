import type { Employee } from "./employee";

// Time period granularity
export type TimePeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

// Analytics filters
export interface SalesAnalyticsFilters {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  employeeIds?: string[];
  city?: string;
  cities?: string[];
  regionState?: string;
  regions?: string[];
}

// Overview KPIs
export interface SalesOverview {
  totalSales: number;
  totalCommissions: number;
  activeAgents: number;
  averageOrderValue: number;
  transactionCount: number;
  period: {
    startDate: string;
    endDate: string;
  };
  comparison?: {
    previousPeriodSales: number;
    salesGrowthPercentage: number;
  };
}

// Sales by time
export interface SalesByTime {
  date: string;
  sales: number;
  transactions: number;
  averageOrderValue: number;
  commissions: number;
}

// Sales by employee
export interface SalesByEmployee {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  role: string;
  territories: string[]; // Array of "City, Region"
  totalSales: number;
  totalCommission: number;
  transactionCount: number;
  averageOrderValue: number;
  commissionRate: number;
  rank?: number;
}

// Sales by location
export interface SalesByLocation {
  city: string;
  regionState: string;
  totalSales: number;
  transactionCount: number;
  averageOrderValue: number;
  uniqueCustomers: number;
  topEmployee?: {
    id: string;
    name: string;
    sales: number;
  };
}

// Trend data point
export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

// Employee commission summary
export interface EmployeeCommissionSummary {
  employeeId: string;
  employeeName: string;
  period: string; // e.g., "2025-01" for monthly
  invoiceCount: number;
  totalSales: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  commissionRate: number;
}

// Commission breakdown
export interface CommissionBreakdown {
  invoiceId: string;
  invoiceCode: string;
  date: string;
  customerName: string;
  totalAmount: number;
  commissionAmount: number;
  commissionPercentage: number;
  status: "pending" | "paid";
  splitWith?: string[]; // Array of employee names if split commission
}

// Top performers
export interface TopPerformer {
  employeeId: string;
  employeeName: string;
  value: number;
  metric: string; // e.g., "Total Sales", "Transaction Count"
  rank: number;
}

// Location performance
export interface LocationPerformance {
  location: string; // City or Region
  sales: number;
  transactions: number;
  growth?: number; // Percentage growth vs previous period
  trend: "up" | "down" | "stable";
}

// Analytics export options
export interface ExportOptions {
  format: "excel" | "pdf";
  reportType: "overview" | "by-employee" | "by-location" | "by-time" | "all";
  filters: SalesAnalyticsFilters;
  includeCharts?: boolean;
}

// Real-time analytics update
export interface AnalyticsUpdate {
  type: "sale" | "commission" | "employee" | "location";
  timestamp: string;
  data: {
    employeeId?: string;
    amount?: number;
    location?: string;
    [key: string]: any;
  };
}

// Dashboard widget data
export interface DashboardWidgetData {
  todaysSales: {
    amount: number;
    growth: number; // Percentage vs yesterday
    transactions: number;
  };
  mySales?: {
    // For sales agents
    amount: number;
    transactions: number;
    commission: number;
    rank?: number;
  };
  topAgent: {
    employeeId: string;
    name: string;
    sales: number;
    transactions: number;
  };
  recentActivity: Array<{
    id: string;
    time: string;
    customer: string;
    amount: number;
    agent: string;
    location: string;
  }>;
  reorderAlerts?: Array<{
    id: string;
    code: string;
    name: string;
    currentStock: number;
    reorderPoint: number;
    warehouseId: string;
  }>;
  stats?: {
    activeSalesOrders: number;
    activePurchaseOrders: number;
    lowStockCount: number;
  };
}

// Chart data formats
export interface LineChartData {
  name: string;
  data: Array<{
    x: string | number;
    y: number;
  }>;
}

export interface BarChartData {
  category: string;
  value: number;
  color?: string;
}

export interface PieChartData {
  name: string;
  value: number;
  percentage: number;
  color?: string;
}

// API response types
export interface AnalyticsResponse<T> {
  data: T;
  filters: SalesAnalyticsFilters;
  generatedAt: string;
}

export interface PaginatedAnalyticsResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: SalesAnalyticsFilters;
}
