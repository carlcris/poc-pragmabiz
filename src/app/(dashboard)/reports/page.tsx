"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { MetricCard } from "@/components/shared/MetricCard";
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

const statusConfig = {
  implemented: {
    key: "available",
    variant: "default" as const,
    icon: CheckCircle2,
    color: "text-green-600",
  },
  "in-development": {
    key: "inDevelopment",
    variant: "secondary" as const,
    icon: Clock,
    color: "text-blue-600",
  },
  "coming-soon": {
    key: "comingSoon",
    variant: "outline" as const,
    icon: Sparkles,
    color: "text-orange-600",
  },
};

export default function ReportsPage() {
  const t = useTranslations("reportsPage");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const reportCategories = useMemo<ReportCategory[]>(
    () => [
      {
        id: "inventory",
        name: t("inventoryName"),
        description: t("inventoryDescription"),
        icon: Package,
        reports: [
          {
            id: "stock-reports",
            name: t("stockReportsName"),
            description: t("stockReportsDescription"),
            status: "implemented",
            businessValue: t("stockReportsValue"),
            path: "/reports/stock",
            icon: Package,
          },
          {
            id: "stock-aging",
            name: t("stockAgingName"),
            description: t("stockAgingDescription"),
            status: "implemented",
            businessValue: t("stockAgingValue"),
            path: "/reports/stock-aging",
            icon: Clock,
          },
          {
            id: "abc-analysis",
            name: t("abcAnalysisName"),
            description: t("abcAnalysisDescription"),
            status: "coming-soon",
            businessValue: t("abcAnalysisValue"),
            icon: BarChart3,
          },
          {
            id: "stock-turnover",
            name: t("stockTurnoverName"),
            description: t("stockTurnoverDescription"),
            status: "coming-soon",
            businessValue: t("stockTurnoverValue"),
            icon: TrendingUp,
          },
          {
            id: "reorder-analysis",
            name: t("reorderAnalysisName"),
            description: t("reorderAnalysisDescription"),
            status: "coming-soon",
            businessValue: t("reorderAnalysisValue"),
            icon: Package,
          },
          {
            id: "warehouse-utilization",
            name: t("warehouseUtilizationName"),
            description: t("warehouseUtilizationDescription"),
            status: "coming-soon",
            businessValue: t("warehouseUtilizationValue"),
            icon: Truck,
          },
          {
            id: "stock-variance",
            name: t("stockVarianceName"),
            description: t("stockVarianceDescription"),
            status: "coming-soon",
            businessValue: t("stockVarianceValue"),
            icon: CheckCircle2,
          },
          {
            id: "batch-traceability",
            name: t("batchTraceabilityName"),
            description: t("batchTraceabilityDescription"),
            status: "coming-soon",
            businessValue: t("batchTraceabilityValue"),
            icon: FileText,
          },
          {
            id: "item-location-batch",
            name: t("itemLocationBatchName"),
            description: t("itemLocationBatchDescription"),
            status: "implemented",
            businessValue: t("itemLocationBatchValue"),
            path: "/reports/item-location-batch",
            icon: MapPin,
          },
        ],
      },
      {
        id: "financial",
        name: t("financialName"),
        description: t("financialDescription"),
        icon: DollarSign,
        reports: [
          { id: "pl-statement", name: t("plStatementName"), description: t("plStatementDescription"), status: "coming-soon", businessValue: t("plStatementValue"), icon: FileText },
          { id: "balance-sheet", name: t("balanceSheetName"), description: t("balanceSheetDescription"), status: "coming-soon", businessValue: t("balanceSheetValue"), icon: BarChart3 },
          { id: "cash-flow", name: t("cashFlowName"), description: t("cashFlowDescription"), status: "coming-soon", businessValue: t("cashFlowValue"), icon: DollarSign },
          { id: "ar-aging", name: t("arAgingName"), description: t("arAgingDescription"), status: "coming-soon", businessValue: t("arAgingValue"), icon: Clock },
          { id: "ap-aging", name: t("apAgingName"), description: t("apAgingDescription"), status: "coming-soon", businessValue: t("apAgingValue"), icon: Clock },
          { id: "sales-profitability", name: t("salesProfitabilityName"), description: t("salesProfitabilityDescription"), status: "coming-soon", businessValue: t("salesProfitabilityValue"), icon: TrendingUp },
          { id: "cogs-analysis", name: t("cogsAnalysisName"), description: t("cogsAnalysisDescription"), status: "coming-soon", businessValue: t("cogsAnalysisValue"), icon: BarChart3 },
        ],
      },
      {
        id: "purchasing",
        name: t("purchasingName"),
        description: t("purchasingDescription"),
        icon: ShoppingCart,
        reports: [
          {
            id: "shipments-report",
            name: t("shipmentsReportName"),
            description: t("shipmentsReportDescription"),
            status: "implemented",
            businessValue: t("shipmentsReportValue"),
            path: "/reports/shipments",
            icon: Truck,
          },
          { id: "supplier-scorecard", name: t("supplierScorecardName"), description: t("supplierScorecardDescription"), status: "coming-soon", businessValue: t("supplierScorecardValue"), icon: CheckCircle2 },
          { id: "po-variance", name: t("poVarianceName"), description: t("poVarianceDescription"), status: "coming-soon", businessValue: t("poVarianceValue"), icon: BarChart3 },
          { id: "supplier-spend", name: t("supplierSpendName"), description: t("supplierSpendDescription"), status: "coming-soon", businessValue: t("supplierSpendValue"), icon: DollarSign },
          { id: "price-variance", name: t("priceVarianceName"), description: t("priceVarianceDescription"), status: "coming-soon", businessValue: t("priceVarianceValue"), icon: TrendingUp },
        ],
      },
      {
        id: "operations",
        name: t("operationsName"),
        description: t("operationsDescription"),
        icon: Truck,
        reports: [
          { id: "delivery-performance", name: t("deliveryPerformanceName"), description: t("deliveryPerformanceDescription"), status: "coming-soon", businessValue: t("deliveryPerformanceValue"), icon: Truck },
          { id: "picking-efficiency", name: t("pickingEfficiencyName"), description: t("pickingEfficiencyDescription"), status: "implemented", businessValue: t("pickingEfficiencyValue"), path: "/reports/picking-efficiency", icon: CheckCircle2 },
          { id: "stock-transfer", name: t("stockTransferName"), description: t("stockTransferDescription"), status: "coming-soon", businessValue: t("stockTransferValue"), icon: Truck },
          { id: "transformation-efficiency", name: t("transformationEfficiencyName"), description: t("transformationEfficiencyDescription"), status: "implemented", businessValue: t("transformationEfficiencyValue"), path: "/reports/transformation-efficiency", icon: Package },
          { id: "rts-analysis", name: t("rtsAnalysisName"), description: t("rtsAnalysisDescription"), status: "coming-soon", businessValue: t("rtsAnalysisValue"), icon: ShoppingCart },
        ],
      },
      {
        id: "executive",
        name: t("executiveName"),
        description: t("executiveDescription"),
        icon: BarChart3,
        reports: [
          { id: "executive-summary", name: t("executiveSummaryName"), description: t("executiveSummaryDescription"), status: "coming-soon", businessValue: t("executiveSummaryValue"), icon: BarChart3 },
          { id: "period-comparison", name: t("periodComparisonName"), description: t("periodComparisonDescription"), status: "coming-soon", businessValue: t("periodComparisonValue"), icon: TrendingUp },
          { id: "budget-actual", name: t("budgetActualName"), description: t("budgetActualDescription"), status: "coming-soon", businessValue: t("budgetActualValue"), icon: DollarSign },
        ],
      },
      {
        id: "audit",
        name: t("auditName"),
        description: t("auditDescription"),
        icon: FileText,
        reports: [
          { id: "audit-trail", name: t("auditTrailName"), description: t("auditTrailDescription"), status: "coming-soon", businessValue: t("auditTrailValue"), icon: FileText },
          { id: "document-status", name: t("documentStatusName"), description: t("documentStatusDescription"), status: "coming-soon", businessValue: t("documentStatusValue"), icon: Clock },
          { id: "user-activity", name: t("userActivityName"), description: t("userActivityDescription"), status: "coming-soon", businessValue: t("userActivityValue"), icon: CheckCircle2 },
        ],
      },
      {
        id: "predictive",
        name: t("predictiveName"),
        description: t("predictiveDescription"),
        icon: Sparkles,
        reports: [
          { id: "demand-forecast", name: t("demandForecastName"), description: t("demandForecastDescription"), status: "coming-soon", businessValue: t("demandForecastValue"), icon: TrendingUp },
          { id: "what-if-analysis", name: t("whatIfName"), description: t("whatIfDescription"), status: "coming-soon", businessValue: t("whatIfValue"), icon: Sparkles },
        ],
      },
    ],
    [t]
  );

  const filteredCategories = reportCategories
    .map((category) => ({
      ...category,
      reports: category.reports.filter(
        (report) =>
          report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          report.description.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((category) =>
      selectedCategory === "all"
        ? category.reports.length > 0
        : category.id === selectedCategory && category.reports.length > 0
    );

  const totalReports = reportCategories.reduce((sum, category) => sum + category.reports.length, 0);
  const implementedReports = reportCategories.reduce(
    (sum, category) => sum + category.reports.filter((report) => report.status === "implemented").length,
    0
  );
  const comingSoonReports = reportCategories.reduce(
    (sum, category) => sum + category.reports.filter((report) => report.status === "coming-soon").length,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title={t("totalReports")}
          icon={FileText}
          value={String(totalReports)}
          caption={t("totalReportsDescription", { count: reportCategories.length })}
        />
        <MetricCard
          title={t("availableNow")}
          icon={CheckCircle2}
          iconClassName="h-4 w-4 text-green-600"
          value={String(implementedReports)}
          caption={t("availableNowDescription")}
        />
        <MetricCard
          title={t("comingSoon")}
          icon={Sparkles}
          iconClassName="h-4 w-4 text-orange-600"
          value={String(comingSoonReports)}
          caption={t("comingSoonDescription")}
        />
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="all">{t("allReports")}</TabsTrigger>
          {reportCategories.map((category) => (
            <TabsTrigger key={category.id} value={category.id}>
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6 space-y-8">
          {filteredCategories.map((category) => (
            <div key={category.id} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <category.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{category.name}</h2>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {category.reports.map((report) => {
                  const StatusIcon = statusConfig[report.status].icon;
                  const isAvailable = report.status === "implemented";

                  const reportCard = (
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
                            {t(statusConfig[report.status].key)}
                          </Badge>
                        </div>
                        <CardDescription className="text-sm leading-relaxed">
                          {report.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          <strong className="text-foreground">{t("valueLabel")}:</strong> {report.businessValue}
                        </p>
                        {isAvailable && (
                          <div className="flex items-center gap-1 pt-2 text-xs font-medium text-primary">
                            <span>{t("openReport")}</span>
                            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );

                  return isAvailable && report.path ? (
                    <Link key={report.id} href={report.path}>
                      {reportCard}
                    </Link>
                  ) : (
                    <div key={report.id}>{reportCard}</div>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="py-12 text-center">
              <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">{t("noReportsFound")}</h3>
              <p className="text-muted-foreground">{t("noReportsFoundDescription")}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h4 className="mb-1 font-semibold">{t("roadmapTitle")}</h4>
              <p className="text-sm text-muted-foreground">{t("roadmapDescription")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
