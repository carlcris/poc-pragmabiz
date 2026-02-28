"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Truck,
  BarChart3,
  FileText,
  Search,
  Clock,
  CheckCircle2,
  MapPin,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

type ReportStatus = "implemented" | "coming-soon" | "in-development";

type Report = {
  id: string;
  name: string;
  description: string;
  status: ReportStatus;
  priority: "critical" | "high" | "medium" | "low";
  estimatedEffort?: string;
  businessValue: string;
  path?: string;
  icon: LucideIcon;
};

type ReportCategory = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  reports: Report[];
};

const reportCategories: ReportCategory[] = [
  {
    id: "inventory",
    name: "Inventory & Warehouse",
    description: "Optimize stock levels, reduce waste, and improve warehouse efficiency",
    icon: Package,
    reports: [
      {
        id: "stock-reports",
        name: "Stock Reports",
        description: "Stock movement and valuation analysis with comprehensive inventory metrics",
        status: "implemented",
        priority: "high",
        businessValue: "Complete inventory visibility",
        path: "/reports/stock",
        icon: Package,
      },
      {
        id: "stock-aging",
        name: "Stock Aging Report",
        description: "Identify slow-moving and obsolete inventory to optimize working capital",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "5-7 days",
        businessValue: "15-25% reduction in obsolete inventory",
        icon: Clock,
      },
      {
        id: "abc-analysis",
        name: "ABC Analysis Report",
        description: "Classify inventory by value contribution using Pareto principle",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "5-7 days",
        businessValue: "20-30% improvement in inventory management efficiency",
        icon: BarChart3,
      },
      {
        id: "stock-turnover",
        name: "Stock Turnover Report",
        description: "Measure inventory efficiency and identify capital utilization opportunities",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "7-10 days",
        businessValue: "10-15% improvement in cash flow",
        icon: TrendingUp,
      },
      {
        id: "reorder-analysis",
        name: "Reorder Point Analysis",
        description: "Optimize reorder levels to prevent stockouts while minimizing excess inventory",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "10-12 days",
        businessValue: "30-50% reduction in stockouts",
        icon: Package,
      },
      {
        id: "warehouse-utilization",
        name: "Warehouse Space Utilization",
        description: "Optimize warehouse layout, capacity planning, and picking efficiency",
        status: "coming-soon",
        priority: "medium",
        estimatedEffort: "8-10 days",
        businessValue: "15-20% improvement in picking efficiency",
        icon: Truck,
      },
      {
        id: "stock-variance",
        name: "Stock Variance Report (Cycle Count)",
        description: "Track accuracy between system and physical stock, identify shrinkage",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "12-15 days",
        businessValue: "95%+ inventory accuracy",
        icon: CheckCircle2,
      },
      {
        id: "batch-traceability",
        name: "Batch/Serial Traceability",
        description: "Full lineage tracking for recalls, quality control, and compliance",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "10-14 days",
        businessValue: "Critical for quality control and regulatory compliance",
        icon: FileText,
      },
      {
        id: "item-location-batch",
        name: "Item Location (Location + Batch)",
        description: "Exact stock balances by warehouse location and batch, including location batch SKU",
        status: "implemented",
        priority: "high",
        businessValue: "Operational visibility for picking, putaway, and batch control",
        path: "/reports/item-location-batch",
        icon: MapPin,
      },
    ],
  },
  {
    id: "financial",
    name: "Financial & Profitability",
    description: "Complete financial statements and profitability analysis",
    icon: DollarSign,
    reports: [
      {
        id: "pl-statement",
        name: "Profit & Loss Statement",
        description: "Standard financial performance report showing profitability",
        status: "coming-soon",
        priority: "critical",
        estimatedEffort: "10-14 days",
        businessValue: "Core financial reporting requirement",
        icon: FileText,
      },
      {
        id: "balance-sheet",
        name: "Balance Sheet",
        description: "Financial position snapshot showing assets, liabilities, and equity",
        status: "coming-soon",
        priority: "critical",
        estimatedEffort: "10-14 days",
        businessValue: "Financial health assessment",
        icon: BarChart3,
      },
      {
        id: "cash-flow",
        name: "Cash Flow Statement",
        description: "Track cash movements and liquidity management",
        status: "coming-soon",
        priority: "critical",
        estimatedEffort: "12-16 days",
        businessValue: "Liquidity management and funding planning",
        icon: DollarSign,
      },
      {
        id: "ar-aging",
        name: "Accounts Receivable Aging",
        description: "Track customer payment performance and manage collections",
        status: "coming-soon",
        priority: "critical",
        estimatedEffort: "7-10 days",
        businessValue: "20-30% reduction in DSO",
        icon: Clock,
      },
      {
        id: "ap-aging",
        name: "Accounts Payable Aging",
        description: "Manage supplier payment obligations and optimize payment timing",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "7-10 days",
        businessValue: "5-10% improvement in working capital",
        icon: Clock,
      },
      {
        id: "sales-profitability",
        name: "Sales Profitability Report",
        description: "True profit analysis by invoice, customer, item, and employee",
        status: "coming-soon",
        priority: "critical",
        estimatedEffort: "12-15 days",
        businessValue: "15-25% improvement in overall margin",
        icon: TrendingUp,
      },
      {
        id: "cogs-analysis",
        name: "COGS Analysis Report",
        description: "Detailed cost of goods sold breakdown and variance analysis",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "7-10 days",
        businessValue: "Better cost control and pricing decisions",
        icon: BarChart3,
      },
    ],
  },
  {
    id: "purchasing",
    name: "Purchasing & Suppliers",
    description: "Supplier performance tracking and procurement optimization",
    icon: ShoppingCart,
    reports: [
      {
        id: "supplier-scorecard",
        name: "Supplier Performance Scorecard",
        description: "Evaluate supplier reliability and performance for better sourcing",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "12-15 days",
        businessValue: "10-20% improvement in supplier reliability",
        icon: CheckCircle2,
      },
      {
        id: "po-variance",
        name: "PO vs Receipt Variance",
        description: "Track order fulfillment accuracy and pricing compliance",
        status: "coming-soon",
        priority: "medium",
        estimatedEffort: "7-10 days",
        businessValue: "Better supplier accountability",
        icon: BarChart3,
      },
      {
        id: "supplier-spend",
        name: "Supplier Spend Analysis",
        description: "Understand purchasing patterns and optimize supplier relationships",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "6-8 days",
        businessValue: "5-15% reduction in procurement costs",
        icon: DollarSign,
      },
      {
        id: "price-variance",
        name: "Purchase Price Variance",
        description: "Monitor cost changes and control procurement budget",
        status: "coming-soon",
        priority: "medium",
        estimatedEffort: "6-8 days",
        businessValue: "Cost control and budgeting",
        icon: TrendingUp,
      },
    ],
  },
  // {
  //   id: "sales",
  //   name: "Sales & Customers",
  //   description: "Customer analytics and sales performance insights",
  //   icon: TrendingUp,
  //   reports: [
  //     {
  //       id: "sales-analytics",
  //       name: "Sales Analytics",
  //       description: "Comprehensive insights into sales performance across agents, locations, and time",
  //       status: "implemented",
  //       priority: "high",
  //       businessValue: "Complete sales visibility",
  //       path: "/reports/sales-analytics",
  //       icon: BarChart3,
  //     },
  //     {
  //       id: "commission-reports",
  //       name: "Commission Reports",
  //       description: "Track and analyze employee commissions with detailed breakdowns",
  //       status: "implemented",
  //       priority: "high",
  //       businessValue: "Complete commission tracking",
  //       path: "/reports/commission",
  //       icon: DollarSign,
  //     },
  //     {
  //       id: "customer-profitability",
  //       name: "Customer Profitability Analysis",
  //       description: "Identify most valuable customers and optimize relationship management",
  //       status: "coming-soon",
  //       priority: "critical",
  //       estimatedEffort: "12-15 days",
  //       businessValue: "20-30% improvement in customer retention",
  //       icon: DollarSign,
  //     },
  //     {
  //       id: "order-fulfillment",
  //       name: "Sales Order Fulfillment",
  //       description: "Track order delivery performance and customer satisfaction",
  //       status: "coming-soon",
  //       priority: "high",
  //       estimatedEffort: "10-12 days",
  //       businessValue: "25-40% improvement in on-time delivery",
  //       icon: Truck,
  //     },
  //     {
  //       id: "category-trend",
  //       name: "Sales by Category Trend",
  //       description: "Identify product demand patterns for inventory and sales planning",
  //       status: "coming-soon",
  //       priority: "medium",
  //       estimatedEffort: "7-9 days",
  //       businessValue: "Better inventory planning",
  //       icon: TrendingUp,
  //     },
  //     {
  //       id: "rfm-analysis",
  //       name: "Customer Behavior (RFM)",
  //       description: "Segment customers for targeted marketing and retention strategies",
  //       status: "coming-soon",
  //       priority: "high",
  //       estimatedEffort: "10-12 days",
  //       businessValue: "15-30% improvement in marketing ROI",
  //       icon: Sparkles,
  //     },
  //     {
  //       id: "quote-conversion",
  //       name: "Quotation Conversion Report",
  //       description: "Track quote-to-order conversion efficiency and sales effectiveness",
  //       status: "coming-soon",
  //       priority: "medium",
  //       estimatedEffort: "7-10 days",
  //       businessValue: "10-20% improvement in conversion rate",
  //       icon: TrendingUp,
  //     },
  //     {
  //       id: "lost-sales",
  //       name: "Lost Sales Report",
  //       description: "Track revenue lost due to stockouts and inventory issues",
  //       status: "coming-soon",
  //       priority: "medium",
  //       estimatedEffort: "8-10 days",
  //       businessValue: "30-50% reduction in stockouts when monitored",
  //       icon: Clock,
  //     },
  //   ],
  // },
  {
    id: "operations",
    name: "Operations & Logistics",
    description: "Operational efficiency and delivery performance metrics",
    icon: Truck,
    reports: [
      {
        id: "delivery-performance",
        name: "Delivery Performance Dashboard",
        description: "Monitor logistics efficiency and delivery reliability",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "8-10 days",
        businessValue: "20-35% improvement in delivery performance",
        icon: Truck,
      },
      {
        id: "picking-efficiency",
        name: "Picking Efficiency Report",
        description: "Measure warehouse picking productivity and accuracy",
        status: "implemented",
        priority: "high",
        businessValue: "25-40% improvement in picking productivity",
        path: "/reports/picking-efficiency",
        icon: CheckCircle2,
      },
      {
        id: "stock-transfer",
        name: "Stock Transfer Analysis",
        description: "Understand inter-warehouse movements and optimize stocking levels",
        status: "coming-soon",
        priority: "medium",
        estimatedEffort: "8-10 days",
        businessValue: "20-40% reduction in inter-warehouse transfers",
        icon: Truck,
      },
      {
        id: "transformation-efficiency",
        name: "Transformation Efficiency",
        description: "Monitor manufacturing/processing operations and optimize yields",
        status: "implemented",
        priority: "medium",
        businessValue: "10-25% improvement in yield",
        path: "/reports/transformation-efficiency",
        icon: Package,
      },
      {
        id: "rts-analysis",
        name: "Return to Supplier Analysis",
        description: "Track quality issues and manage supplier accountability",
        status: "coming-soon",
        priority: "medium",
        estimatedEffort: "5-7 days",
        businessValue: "Improve supplier quality",
        icon: ShoppingCart,
      },
    ],
  },
  {
    id: "executive",
    name: "Executive Dashboards",
    description: "High-level business overview and strategic insights",
    icon: BarChart3,
    reports: [
      {
        id: "executive-summary",
        name: "Executive Summary Dashboard",
        description: "One-page business overview for executive decision-making",
        status: "coming-soon",
        priority: "critical",
        estimatedEffort: "15-20 days",
        businessValue: "Quick executive decision-making",
        icon: BarChart3,
      },
      {
        id: "period-comparison",
        name: "Period-over-Period Comparison",
        description: "Track business growth and identify trends",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "8-10 days",
        businessValue: "Understand business trajectory",
        icon: TrendingUp,
      },
      {
        id: "budget-actual",
        name: "Budget vs Actual Report",
        description: "Financial planning and control through budget tracking",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "15-20 days",
        businessValue: "Financial discipline and control",
        icon: DollarSign,
      },
    ],
  },
  {
    id: "audit",
    name: "Audit & Compliance",
    description: "System activity tracking and compliance reporting",
    icon: FileText,
    reports: [
      {
        id: "audit-trail",
        name: "Audit Trail Report",
        description: "Track all system changes for security, compliance, and investigation",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "12-15 days",
        businessValue: "Security monitoring and compliance",
        icon: FileText,
      },
      {
        id: "document-status",
        name: "Document Status Tracking",
        description: "Monitor document workflow compliance and identify bottlenecks",
        status: "coming-soon",
        priority: "medium",
        estimatedEffort: "8-10 days",
        businessValue: "Process efficiency improvement",
        icon: Clock,
      },
      {
        id: "user-activity",
        name: "User Activity Report",
        description: "Monitor system usage for license optimization and security",
        status: "coming-soon",
        priority: "medium",
        estimatedEffort: "6-8 days",
        businessValue: "License optimization and security",
        icon: CheckCircle2,
      },
    ],
  },
  {
    id: "predictive",
    name: "Predictive Analytics",
    description: "Forecasting and scenario planning for strategic decisions",
    icon: Sparkles,
    reports: [
      {
        id: "demand-forecast",
        name: "Demand Forecasting Report",
        description: "Predict future sales for proactive inventory planning",
        status: "coming-soon",
        priority: "high",
        estimatedEffort: "15-20 days",
        businessValue: "20-30% inventory optimization",
        icon: TrendingUp,
      },
      {
        id: "what-if-analysis",
        name: "What-If Analysis Tools",
        description: "Scenario planning and strategic decision support",
        status: "coming-soon",
        priority: "medium",
        estimatedEffort: "20-25 days",
        businessValue: "Strategic decision-making",
        icon: Sparkles,
      },
    ],
  },
];

const statusConfig = {
  implemented: {
    label: "Available",
    variant: "default" as const,
    icon: CheckCircle2,
    color: "text-green-600",
  },
  "in-development": {
    label: "In Development",
    variant: "secondary" as const,
    icon: Clock,
    color: "text-blue-600",
  },
  "coming-soon": {
    label: "Coming Soon",
    variant: "outline" as const,
    icon: Sparkles,
    color: "text-orange-600",
  },
};

export default function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Filter reports based on search and category
  const filteredCategories = reportCategories
    .map((category) => ({
      ...category,
      reports: category.reports.filter((report) =>
        report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.description.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((category) =>
      selectedCategory === "all"
        ? category.reports.length > 0
        : category.id === selectedCategory && category.reports.length > 0
    );

  // Statistics
  const totalReports = reportCategories.reduce((sum, cat) => sum + cat.reports.length, 0);
  const implementedReports = reportCategories.reduce(
    (sum, cat) => sum + cat.reports.filter((r) => r.status === "implemented").length,
    0
  );
  const comingSoonReports = reportCategories.reduce(
    (sum, cat) => sum + cat.reports.filter((r) => r.status === "coming-soon").length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports Directory</h1>
        <p className="text-muted-foreground">
          Comprehensive reporting suite for business intelligence and operational insights
        </p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReports}</div>
            <p className="text-xs text-muted-foreground">Across {reportCategories.length} categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Now</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{implementedReports}</div>
            <p className="text-xs text-muted-foreground">Ready to use</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coming Soon</CardTitle>
            <Sparkles className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{comingSoonReports}</div>
            <p className="text-xs text-muted-foreground">In our roadmap</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="all">All Reports</TabsTrigger>
          {reportCategories.map((category) => (
            <TabsTrigger key={category.id} value={category.id}>
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="space-y-8 mt-6">
          {filteredCategories.map((category) => (
            <div key={category.id} className="space-y-4">
              {/* Category Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <category.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{category.name}</h2>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
              </div>

              {/* Reports Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {category.reports.map((report) => {
                  const StatusIcon = statusConfig[report.status].icon;
                  const isAvailable = report.status === "implemented";

                  const ReportCard = (
                    <Card
                      className={`group relative overflow-hidden transition-all hover:shadow-md ${
                        isAvailable ? "cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                              <report.icon className="h-4 w-4 text-primary" />
                            </div>
                            <CardTitle className="text-base leading-tight">{report.name}</CardTitle>
                          </div>
                          <Badge variant={statusConfig[report.status].variant}>
                            <StatusIcon className={`mr-1 h-3 w-3 ${statusConfig[report.status].color}`} />
                            {statusConfig[report.status].label}
                          </Badge>
                        </div>
                        <CardDescription className="text-sm leading-relaxed">
                          {report.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            <strong className="text-foreground">Value:</strong> {report.businessValue}
                          </p>
                        </div>
                        {isAvailable && (
                          <div className="flex items-center gap-1 text-xs text-primary font-medium pt-2">
                            <span>Open Report</span>
                            <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );

                  return isAvailable && report.path ? (
                    <Link key={report.id} href={report.path}>
                      {ReportCard}
                    </Link>
                  ) : (
                    <div key={report.id}>{ReportCard}</div>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No reports found</h3>
              <p className="text-muted-foreground">Try adjusting your search query</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Footer Note */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-semibold mb-1">Report Development Roadmap</h4>
              <p className="text-sm text-muted-foreground">
                We&apos;re continuously expanding our reporting capabilities. Reports marked as &quot;Coming
                Soon&quot; are
                prioritized based on business impact and will be delivered in phases over the next 12-15 months.
                Critical and high-priority reports will be implemented first.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
