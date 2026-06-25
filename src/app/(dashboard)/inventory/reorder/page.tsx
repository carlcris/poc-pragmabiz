"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Package,
  TrendingUp,
  Check,
  X,
  ShoppingCart,
  Trash2,
  Calendar,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  useReorderSuggestions,
  useReorderAlerts,
  useReorderStatistics,
  useApproveReorderSuggestion,
  useRejectReorderSuggestion,
  useAcknowledgeAlerts,
  useUnacknowledgeAlerts,
  useReorderSeasons,
  useReorderSeasonItemPolicies,
  useCreateReorderSeason,
  useUpdateReorderSeason,
  useDeleteReorderSeason,
  useCreateReorderSeasonItemPolicy,
  useUpdateReorderSeasonItemPolicy,
  useDeleteReorderSeasonItemPolicy,
} from "@/hooks/useReorder";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/shared/MetricCard";
import { StatusText } from "@/components/shared/StatusText";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReorderSuggestion, ReorderAlert, ReorderSeason } from "@/types/reorder";
import { SeasonItemPolicyDialog } from "@/components/reorder/SeasonItemPolicyDialog";
import { AddSeasonDialog } from "@/components/reorder/AddSeasonDialog";
import {
  StockRequisitionFormDialog,
  type StockRequisitionInitialLineItem,
} from "@/components/stock-requisitions/StockRequisitionFormDialog";
import { toast } from "sonner";

export default function ReorderManagementPage() {
  const [selectedTab, setSelectedTab] = useState("suggestions");
  const t = useTranslations("reorderManagementPage");
  const { formatCurrency } = useCurrency();

  const { data: suggestionsData, isLoading: suggestionsLoading } = useReorderSuggestions();
  const { data: alertsData, isLoading: alertsLoading } = useReorderAlerts({
    acknowledged: "false",
  });
  const { data: acknowledgedAlertsData, isLoading: acknowledgedAlertsLoading } = useReorderAlerts({
    acknowledged: "only",
  });
  const { data: statistics, isLoading: statsLoading } = useReorderStatistics();
  const { data: seasonsData, isLoading: seasonsLoading } = useReorderSeasons({ limit: 50 });

  const approveSuggestion = useApproveReorderSuggestion();
  const rejectSuggestion = useRejectReorderSuggestion();
  const acknowledgeAlerts = useAcknowledgeAlerts();
  const unacknowledgeAlerts = useUnacknowledgeAlerts();
  const createSeason = useCreateReorderSeason();
  const updateSeason = useUpdateReorderSeason();
  const deleteSeason = useDeleteReorderSeason();
  const createPolicy = useCreateReorderSeasonItemPolicy();
  const updatePolicy = useUpdateReorderSeasonItemPolicy();
  const deletePolicy = useDeleteReorderSeasonItemPolicy();

  const suggestions = suggestionsData || [];
  const alerts = useMemo(() => alertsData?.data || [], [alertsData?.data]);
  const acknowledgedAlerts = useMemo(
    () => acknowledgedAlertsData?.data || [],
    [acknowledgedAlertsData?.data]
  );
  const seasons = seasonsData?.data || [];
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);
  const [stockRequisitionDialogOpen, setStockRequisitionDialogOpen] = useState(false);
  const [stockRequisitionLineItems, setStockRequisitionLineItems] = useState<
    StockRequisitionInitialLineItem[]
  >([]);
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [addSeasonDialogOpen, setAddSeasonDialogOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<ReorderSeason | null>(null);
  const { data: selectedSeasonPoliciesData } = useReorderSeasonItemPolicies({
    seasonId: selectedSeason?.id ?? "00000000-0000-0000-0000-000000000000",
    limit: 1000,
  });
  const selectedSeasonPolicies = selectedSeasonPoliciesData?.data || [];

  const handleApproveSuggestion = async (id: string) => {
    await approveSuggestion.mutateAsync(id);
  };

  const handleRejectSuggestion = async (id: string) => {
    await rejectSuggestion.mutateAsync(id);
  };

  const handleAcknowledgeAlert = async (id: string) => {
    await acknowledgeAlerts.mutateAsync({ alertIds: [id] });
  };

  const handleUnacknowledgeAlert = async (id: string) => {
    await unacknowledgeAlerts.mutateAsync({ alertIds: [id] });
  };

  const handleOpenPolicyDialog = (season: ReorderSeason) => {
    setSelectedSeason(season);
    setPolicyDialogOpen(true);
  };

  const handleCreateSeason = async (seasonData: {
    code: string;
    name: string;
    effectiveFrom: string;
    effectiveTo: string;
    priority: number;
    isActive: boolean;
  }) => {
    try {
      await createSeason.mutateAsync(seasonData);
      toast.success(t("seasonCreated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("seasonCreateFailed"));
      throw error; // Re-throw so dialog can handle it
    }
  };

  useEffect(() => {
    if (alerts.length === 0) {
      setSelectedAlertIds((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    setSelectedAlertIds((prev) => {
      const next = prev.filter((id) => alerts.some((alert) => alert.id === id));
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [alerts]);

  const toggleAlertSelection = (id: string, checked: boolean) => {
    setSelectedAlertIds((prev) =>
      checked ? [...prev, id] : prev.filter((alertId) => alertId !== id)
    );
  };

  const handleSelectAllAlerts = (checked: boolean) => {
    setSelectedAlertIds(checked ? alerts.map((alert) => alert.id) : []);
  };

  const handleCreateStockRequisition = () => {
    if (selectedAlertIds.length === 0) return;

    const selectedAlerts = alerts.filter((alert) => selectedAlertIds.includes(alert.id));
    const lineItems: StockRequisitionInitialLineItem[] = [];

    selectedAlerts.forEach((alert) => {
      if (!alert.requisitionUomId) return;

      const fallbackQty = Math.max(0.01, alert.reorderPoint - alert.currentStock);
      const baseQuantity = alert.reorderQuantity > 0 ? alert.reorderQuantity : fallbackQty;
      const qtyPerUnit = alert.requisitionQtyPerUnit > 0 ? alert.requisitionQtyPerUnit : 1;
      const requestedQty = Math.max(0.01, baseQuantity / qtyPerUnit);

      lineItems.push({
        itemId: alert.itemId,
        itemCode: alert.itemCode,
        itemName: alert.itemName,
        itemUnitOptionId: alert.requisitionItemUnitOptionId,
        uomId: alert.requisitionUomId,
        uomLabel: alert.requisitionUomLabel,
        qtyPerUnit: alert.requisitionQtyPerUnit,
        requestedQty,
        unitPrice: alert.requisitionUnitPrice,
        unitPriceCurrency: alert.requisitionUnitPriceCurrency,
        notes: t("reorderAlertLineNote"),
      });
    });

    if (lineItems.length === 0) {
      toast.error(t("noMatchingItemsForAlerts"));
      return;
    }

    setStockRequisitionLineItems(lineItems);
    setStockRequisitionDialogOpen(true);
  };

  const allAlertsSelected = alerts.length > 0 && selectedAlertIds.length === alerts.length;
  const someAlertsSelected = selectedAlertIds.length > 0 && !allAlertsSelected;

  const getWarehouseBreakdown = (alert: ReorderAlert) => {
    if (!Array.isArray(alert.warehouseBreakdown)) return [];
    return alert.warehouseBreakdown
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const row = entry as Record<string, unknown>;
        const warehouseName = typeof row.warehouseName === "string" ? row.warehouseName : "";
        const availableStock = Number(row.availableStock || 0);
        return { warehouseName, availableStock };
      })
      .filter((entry): entry is { warehouseName: string; availableStock: number } => !!entry);
  };

  const getPolicySourceLabel = (alert: ReorderAlert) =>
    alert.policySource === "season_override" && alert.seasonName
      ? t("seasonOverrideSource", { season: alert.seasonName })
      : t("itemDefaultSource");

  const formatAlertMessage = (message: string) =>
    message.replace(/(-?\d+(?:\.\d+)?) units available/g, (_, value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? `${parsed.toFixed(2)} units available` : _;
    });

  const getPriorityBadge = (priority: "high" | "medium" | "low") => {
    const variants = {
      high: { variant: "destructive" as const, label: t("highPriority") },
      medium: { variant: "default" as const, label: t("mediumPriority") },
      low: { variant: "secondary" as const, label: t("lowPriority") },
    };
    const config = variants[priority];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: ReorderSuggestion["status"]) => {
    const variants = {
      pending: { tone: "muted" as const, label: t("pending") },
      approved: { tone: "green" as const, label: t("approved") },
      rejected: { tone: "red" as const, label: t("rejected") },
      ordered: { tone: "blue" as const, label: t("ordered") },
    };
    const config = variants[status];
    return <StatusText tone={config.tone}>{config.label}</StatusText>;
  };

  const getSeverityBadge = (severity: ReorderAlert["severity"]) => {
    const variants = {
      critical: { variant: "destructive" as const, label: t("critical"), icon: AlertTriangle },
      warning: { variant: "default" as const, label: t("warning"), icon: AlertTriangle },
      info: { variant: "secondary" as const, label: t("info"), icon: Package },
    };
    const config = variants[severity];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const renderAlertSkeleton = (showSelection: boolean) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {showSelection && <TableHead className="w-[40px]"></TableHead>}
            <TableHead>{t("severity")}</TableHead>
            <TableHead>{t("item")}</TableHead>
            <TableHead>{t("policySource")}</TableHead>
            <TableHead>{t("stockLevel")}</TableHead>
            <TableHead>{t("message")}</TableHead>
            <TableHead className="text-right">{t("action")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3].map((i) => (
            <TableRow key={i}>
              {showSelection && (
                <TableCell>
                  <Skeleton className="h-4 w-4" />
                </TableCell>
              )}
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-48" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-8 w-24" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderAlertTable = (alertRows: ReorderAlert[], mode: "active" | "acknowledged") => {
    const showSelection = mode === "active";
    const isAcknowledgedMode = mode === "acknowledged";

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {showSelection && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={
                      allAlertsSelected ? true : someAlertsSelected ? "indeterminate" : false
                    }
                    onCheckedChange={(checked) => handleSelectAllAlerts(Boolean(checked))}
                    aria-label={t("selectAllAlerts")}
                  />
                </TableHead>
              )}
              <TableHead>{t("severity")}</TableHead>
              <TableHead>{t("item")}</TableHead>
              <TableHead>{t("policySource")}</TableHead>
              <TableHead>{t("stockLevel")}</TableHead>
              <TableHead>{t("message")}</TableHead>
              {isAcknowledgedMode && <TableHead>{t("acknowledgedAt")}</TableHead>}
              <TableHead className="text-right">{t("action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alertRows.map((alert) => (
              <TableRow key={alert.acknowledgmentId || alert.id}>
                {showSelection && (
                  <TableCell>
                    <Checkbox
                      checked={selectedAlertIds.includes(alert.id)}
                      onCheckedChange={(checked) => toggleAlertSelection(alert.id, Boolean(checked))}
                      aria-label={t("selectAlertFor", { itemName: alert.itemName })}
                    />
                  </TableCell>
                )}
                <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                <TableCell>
                  <div className="font-medium">{alert.itemName}</div>
                  <div className="text-xs text-muted-foreground">{alert.itemCode}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{getPolicySourceLabel(alert)}</div>
                  <div className="text-xs text-muted-foreground">
                    {getWarehouseBreakdown(alert)
                      .map(
                        (warehouse) =>
                          `${warehouse.warehouseName}: ${warehouse.availableStock.toFixed(2)}`
                      )
                      .join(" | ")}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-red-600">
                    {alert.totalAvailableStock.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("minLabel")}: {alert.minimumLevel} | {t("reorderShort")}:{" "}
                    {alert.reorderPoint}
                  </div>
                </TableCell>
                <TableCell className="max-w-md">{formatAlertMessage(alert.message)}</TableCell>
                {isAcknowledgedMode && (
                  <TableCell>
                    <div className="text-sm">
                      {alert.acknowledgedAt
                        ? new Date(alert.acknowledgedAt).toLocaleString()
                        : t("notAvailable")}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-right">
                  {isAcknowledgedMode ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnacknowledgeAlert(alert.id)}
                      disabled={unacknowledgeAlerts.isPending}
                    >
                      <RotateCcw className="mr-1 h-4 w-4" />
                      {t("unacknowledge")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      disabled={acknowledgeAlerts.isPending}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      {t("acknowledge")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t("title")}</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">{t("subtitle")}</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title={t("itemsOk")}
          icon={CheckCircle}
          iconClassName="h-4 w-4 text-green-600"
          value={statistics ? String(statistics.itemsOk) : undefined}
          caption={t("adequatelyStocked")}
          isLoading={statsLoading}
        />
        <MetricCard
          title={t("lowStock")}
          icon={AlertTriangle}
          iconClassName="h-4 w-4 text-yellow-600"
          value={statistics ? String(statistics.itemsLowStock) : undefined}
          caption={t("belowReorderPoint")}
          isLoading={statsLoading}
        />
        <MetricCard
          title={t("critical")}
          icon={XCircle}
          iconClassName="h-4 w-4 text-red-600"
          value={statistics ? String(statistics.itemsCritical) : undefined}
          caption={t("belowMinimumLevel")}
          isLoading={statsLoading}
        />
        <MetricCard
          title={t("pendingOrders")}
          icon={ShoppingCart}
          iconClassName="h-4 w-4 text-blue-600"
          value={statistics ? String(statistics.pendingSuggestions) : undefined}
          caption={t("awaitingApproval")}
          isLoading={statsLoading}
        />
        <MetricCard
          title={t("estimatedCost")}
          icon={TrendingUp}
          iconClassName="h-4 w-4 text-purple-600"
          value={statistics ? formatCurrency(statistics.totalEstimatedReorderCost) : undefined}
          caption={t("totalReorderValue")}
          isLoading={statsLoading}
        />
      </div>

      {/* Tabs for Suggestions and Alerts */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="suggestions">
            {t("reorderSuggestionsTab", { count: suggestions.length })}
          </TabsTrigger>
          <TabsTrigger value="alerts">{t("activeAlertsTab", { count: alerts.length })}</TabsTrigger>
          <TabsTrigger value="configuration">{t("configurationTab")}</TabsTrigger>
        </TabsList>

        {/* Reorder Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("reorderSuggestions")}</CardTitle>
              <CardDescription>{t("reorderSuggestionsDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {suggestionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex-1">
                        <Skeleton className="mb-2 h-5 w-48" />
                        <Skeleton className="mb-1 h-4 w-64" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : suggestions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>{t("noReorderSuggestions")}</p>
                  <p className="mt-1 text-sm">{t("allItemsAdequatelyStocked")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">{suggestion.itemName}</h3>
                          {getPriorityBadge(suggestion.priority)}
                          {getStatusBadge(suggestion.status)}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                          <div>
                            <span className="text-muted-foreground">{t("itemCode")}:</span>
                            <span className="ml-2 font-medium">{suggestion.itemCode}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("warehouse")}:</span>
                            <span className="ml-2 font-medium">{suggestion.warehouseName}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("currentStock")}:</span>
                            <span className="ml-2 font-medium text-red-600">
                              {suggestion.currentStock}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("reorderPoint")}:</span>
                            <span className="ml-2 font-medium">{suggestion.reorderPoint}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                          <div>
                            <span className="text-muted-foreground">{t("suggestedQty")}:</span>
                            <span className="ml-2 font-medium">{suggestion.suggestedQuantity}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              {t("estimatedCostShort")}:
                            </span>
                            <span className="ml-2 font-medium">
                              {formatCurrency(suggestion.estimatedCost)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("supplier")}:</span>
                            <span className="ml-2 font-medium">{suggestion.supplierName}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("leadTime")}:</span>
                            <span className="ml-2 font-medium">
                              {t("leadTimeDays", { count: suggestion.expectedDeliveryDays })}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">{t("reason")}:</span>
                          <span className="ml-2">{suggestion.reason}</span>
                        </div>
                      </div>
                      {suggestion.status === "pending" && (
                        <div className="ml-4 flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveSuggestion(suggestion.id)}
                            disabled={approveSuggestion.isPending}
                          >
                            <Check className="mr-1 h-4 w-4" />
                            {t("approve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectSuggestion(suggestion.id)}
                            disabled={rejectSuggestion.isPending}
                          >
                            <X className="mr-1 h-4 w-4" />
                            {t("reject")}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{t("stockLevelAlerts")}</CardTitle>
                  <CardDescription>{t("stockLevelAlertsDescription")}</CardDescription>
                </div>
                <Button
                  size="sm"
                  disabled={selectedAlertIds.length === 0}
                  onClick={handleCreateStockRequisition}
                >
                  {t("createStockRequisition")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="active" className="space-y-4">
                <TabsList className="grid w-full max-w-xl grid-cols-2">
                  <TabsTrigger value="active">
                    {t("activeAlertsSubTab", { count: alerts.length })}
                  </TabsTrigger>
                  <TabsTrigger value="acknowledged">
                    {t("acknowledgedAlertsSubTab", { count: acknowledgedAlerts.length })}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="space-y-4">
                  {alertsLoading ? (
                    renderAlertSkeleton(true)
                  ) : alerts.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-600 opacity-50" />
                      <p>{t("noActiveAlerts")}</p>
                      <p className="mt-1 text-sm">{t("allStockLevelsAcceptable")}</p>
                    </div>
                  ) : (
                    renderAlertTable(alerts, "active")
                  )}
                </TabsContent>

                <TabsContent value="acknowledged" className="space-y-4">
                  {acknowledgedAlertsLoading ? (
                    renderAlertSkeleton(false)
                  ) : acknowledgedAlerts.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-600 opacity-50" />
                      <p>{t("noAcknowledgedAlerts")}</p>
                      <p className="mt-1 text-sm">{t("acknowledgedAlertsDescription")}</p>
                    </div>
                  ) : (
                    renderAlertTable(acknowledgedAlerts, "acknowledged")
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {t("seasonalReorderRules")}
                  </CardTitle>
                  <CardDescription>{t("seasonalReorderRulesDescription")}</CardDescription>
                </div>
                <Button
                  onClick={() => setAddSeasonDialogOpen(true)}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("newSeason")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Seasons table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="uppercase text-xs font-semibold">
                        {t("season")}
                      </TableHead>
                      <TableHead className="uppercase text-xs font-semibold">
                        {t("effectiveDates")}
                      </TableHead>
                      <TableHead className="uppercase text-xs font-semibold">
                        {t("priority")}
                      </TableHead>
                      <TableHead className="uppercase text-xs font-semibold">
                        {t("itemsOverridden")}
                      </TableHead>
                      <TableHead className="uppercase text-xs font-semibold">
                        {t("status")}
                      </TableHead>
                      <TableHead className="text-right uppercase text-xs font-semibold">
                        {t("actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seasonsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t("loadingSeasons")}
                        </TableCell>
                      </TableRow>
                    ) : seasons.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t("noSeasonsConfigured")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      seasons.map((season) => (
                          <TableRow key={season.id} className="hover:bg-muted/30">
                            <TableCell>
                              <div className="font-semibold">{season.name}</div>
                              <div className="text-xs text-muted-foreground">{season.code}</div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {season.effectiveFrom} &ndash; {season.effectiveTo}
                            </TableCell>
                            <TableCell className="text-sm">{season.priority}</TableCell>
                            <TableCell>
                              <Button
                                variant="link"
                                className="h-auto p-0 text-sm text-primary hover:underline"
                                onClick={() => handleOpenPolicyDialog(season)}
                              >
                                {t("managePolicies")}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={season.isActive}
                                onCheckedChange={(checked) =>
                                  updateSeason.mutate({
                                    id: season.id,
                                    data: { isActive: checked },
                                  })
                                }
                                disabled={updateSeason.isPending}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (
                                    confirm(
                                      t("deleteSeasonConfirm", { name: season.name })
                                    )
                                  ) {
                                    deleteSeason.mutate(season.id);
                                  }
                                }}
                                disabled={deleteSeason.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">{t("deleteSeason")}</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {stockRequisitionDialogOpen && (
        <StockRequisitionFormDialog
          open={stockRequisitionDialogOpen}
          onOpenChange={setStockRequisitionDialogOpen}
          initialLineItems={stockRequisitionLineItems}
          initialActiveTab="items"
        />
      )}

      <AddSeasonDialog
        open={addSeasonDialogOpen}
        onOpenChange={setAddSeasonDialogOpen}
        onCreateSeason={handleCreateSeason}
      />

      <SeasonItemPolicyDialog
        open={policyDialogOpen}
        season={selectedSeason}
        policies={selectedSeason ? selectedSeasonPolicies : []}
        onOpenChange={setPolicyDialogOpen}
        onCreatePolicy={async (policy) => {
          await createPolicy.mutateAsync(policy);
        }}
        onUpdatePolicy={async (policyId, updates) => {
          await updatePolicy.mutateAsync({ id: policyId, data: updates });
        }}
        onDeletePolicy={async (policyId) => {
          await deletePolicy.mutateAsync(policyId);
        }}
      />
    </div>
  );
}
