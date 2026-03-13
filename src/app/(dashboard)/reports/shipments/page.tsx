"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Box, Download, Package, RefreshCw, Search, Ship, Truck } from "lucide-react";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useShipmentsReport, type ShipmentStageFilter } from "@/hooks/useShipmentsReport";
import { MetricCard } from "@/components/shared/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function ShipmentsReportPage() {
  const t = useTranslations("shipmentsReportPage");
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("all");
  const [shipmentStage, setShipmentStage] = useState<ShipmentStageFilter>("all");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const { data: suppliersData } = useSuppliers({ page: 1, limit: 50 });
  const suppliers = suppliersData?.data || [];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const reportQuery = useShipmentsReport({
    page,
    limit,
    search: search || undefined,
    supplierId: supplierId !== "all" ? supplierId : undefined,
    shipmentStage,
  });

  const formatNumber = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number.isFinite(value) ? value : 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "PHP" }).format(value || 0);

  const formatDate = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "short",
          day: "2-digit",
        }).format(new Date(value))
      : t("noValue");

  const getStageBadge = (stage: Exclude<ShipmentStageFilter, "all">) => {
    if (stage === "incoming") {
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">{t("incoming")}</Badge>;
    }
    if (stage === "in_transit") {
      return (
        <Badge className="bg-purple-100 text-purple-700 border-purple-200">{t("inTransit")}</Badge>
      );
    }
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{t("arrived")}</Badge>;
  };

  const handleReset = () => {
    setPage(1);
    setLimit(25);
    setSearchInput("");
    setSearch("");
    setSupplierId("all");
    setShipmentStage("all");
  };

  const handleExportPdf = async () => {
    if (!reportQuery.data || reportQuery.data.data.length === 0) {
      return;
    }

    try {
      setIsExportingPdf(true);
      const [{ pdf }, { ShipmentsReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/reports/ShipmentsReportPDF"),
      ]);

      const pageSummary = t("pageOfTotal", {
        page: formatNumber(reportQuery.data.pagination.page),
        totalPages: formatNumber(reportQuery.data.pagination.totalPages),
        total: formatNumber(reportQuery.data.pagination.total),
      });

      const blob = await pdf(
        <ShipmentsReportPDF
          title={t("title")}
          subtitle={t("subtitle")}
          generatedAtLabel={t("generatedAt")}
          loadListLabel={t("loadList")}
          supplierLabel={t("supplier")}
          containerSealLabel={t("containerSeal")}
          shipmentStageLabel={t("shipmentStage")}
          etaLabel={t("eta")}
          actualArrivalLabel={t("actualArrival")}
          quantityLabel={t("quantity")}
          valueLabel={t("value")}
          noValueLabel={t("noValue")}
          loadingLabel={t("incoming")}
          inTransitLabel={t("inTransit")}
          arrivedLabel={t("arrived")}
          pageSummary={pageSummary}
          rows={reportQuery.data.data}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileSuffix = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `shipments-report-${fileSuffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t("title")}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("reset")}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPdf}
            disabled={isExportingPdf || reportQuery.isLoading || !reportQuery.data || reportQuery.data.data.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExportingPdf ? t("exportingPdf") : t("exportPdf")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={t("totalShipments")}
          icon={Truck}
          iconClassName="h-4 w-4 text-blue-600"
          value={reportQuery.data ? formatNumber(reportQuery.data.summary.totalShipments) : undefined}
          caption={t("totalShipmentsDescription")}
          isLoading={reportQuery.isLoading}
        />
        <MetricCard
          title={t("containers")}
          icon={Box}
          iconClassName="h-4 w-4 text-purple-600"
          value={reportQuery.data ? formatNumber(reportQuery.data.summary.totalContainers) : undefined}
          caption={t("containersDescription")}
          isLoading={reportQuery.isLoading}
        />
        <MetricCard
          title={t("totalQuantity")}
          icon={Package}
          iconClassName="h-4 w-4 text-green-600"
          value={reportQuery.data ? formatNumber(reportQuery.data.summary.totalQuantity, 2) : undefined}
          caption={t("totalQuantityDescription")}
          isLoading={reportQuery.isLoading}
        />
        <MetricCard
          title={t("totalValue")}
          icon={Ship}
          iconClassName="h-4 w-4 text-amber-600"
          value={reportQuery.data ? formatCurrency(reportQuery.data.summary.totalValue) : undefined}
          caption={t("totalValueDescription")}
          isLoading={reportQuery.isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("search")}</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="pl-9"
                  placeholder={t("searchPlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("supplier")}</label>
              <Select
                value={supplierId}
                onValueChange={(value) => {
                  setSupplierId(value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("allSuppliers")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allSuppliers")}</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.code} - {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("shipmentStage")}</label>
              <Select
                value={shipmentStage}
                onValueChange={(value) => {
                  setShipmentStage(value as ShipmentStageFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allStages")}</SelectItem>
                  <SelectItem value="incoming">{t("incoming")}</SelectItem>
                  <SelectItem value="in_transit">{t("inTransit")}</SelectItem>
                  <SelectItem value="arrived">{t("arrived")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("rowsPerPage")}</label>
              <Select
                value={String(limit)}
                onValueChange={(value) => {
                  setLimit(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("shipments")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("loadList")}</TableHead>
                  <TableHead>{t("supplier")}</TableHead>
                  <TableHead>{t("containerSeal")}</TableHead>
                  <TableHead>{t("shipmentStage")}</TableHead>
                  <TableHead>{t("eta")}</TableHead>
                  <TableHead>{t("actualArrival")}</TableHead>
                  <TableHead className="text-right">{t("quantity")}</TableHead>
                  <TableHead className="text-right">{t("value")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportQuery.isLoading ? (
                  [...Array(8)].map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : reportQuery.isError ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      {t("loadError")}
                    </TableCell>
                  </TableRow>
                ) : !reportQuery.data || reportQuery.data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      {t("noRows")}
                    </TableCell>
                  </TableRow>
                ) : (
                  reportQuery.data.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="min-w-[180px]">
                        <div className="font-medium">{row.llNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.supplierLlNumber || t("noValue")}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <div className="font-medium">{row.supplierName || t("noValue")}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.supplierCode || t("noValue")}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[200px]">
                        <div>{row.containerNumber || t("noValue")}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.sealNumber || t("noValue")}
                        </div>
                      </TableCell>
                      <TableCell>{getStageBadge(row.shipmentStage)}</TableCell>
                      <TableCell>{formatDate(row.estimatedArrivalDate)}</TableCell>
                      <TableCell>{formatDate(row.actualArrivalDate)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.totalQuantity, 2)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.totalValue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {reportQuery.data
                ? t("pageOfTotal", {
                    page: formatNumber(reportQuery.data.pagination.page),
                    totalPages: formatNumber(reportQuery.data.pagination.totalPages),
                    total: formatNumber(reportQuery.data.pagination.total),
                  })
                : t("pageOfTotal", { page: formatNumber(page), totalPages: "1", total: "0" })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={reportQuery.isLoading || page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                {t("previous")}
              </Button>
              <Badge variant="secondary">{page}</Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  reportQuery.isLoading ||
                  !reportQuery.data ||
                  page >= reportQuery.data.pagination.totalPages
                }
                onClick={() => setPage((value) => value + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
