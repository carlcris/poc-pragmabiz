"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
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
} from "lucide-react";
import {
  useReorderSuggestions,
  useReorderAlerts,
  useReorderStatistics,
  useApproveReorderSuggestion,
  useRejectReorderSuggestion,
  useAcknowledgeAlerts,
} from "@/hooks/useReorder";
import { useItems } from "@/hooks/useItems";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReorderSuggestion, ReorderAlert } from "@/types/reorder";
import type { PurchaseOrderLineItemFormValues } from "@/components/purchase-orders/PurchaseOrderLineItemDialog";
import { toast } from "sonner";

const PurchaseOrderFormDialog = dynamic(
  () =>
    import("@/components/purchase-orders/PurchaseOrderFormDialog").then(
      (mod) => mod.PurchaseOrderFormDialog
    ),
  { ssr: false }
);

export default function ReorderManagementPage() {
  const [selectedTab, setSelectedTab] = useState("suggestions");
  const t = useTranslations("reorderManagementPage");
  const { formatCurrency } = useCurrency();

  const { data: suggestionsData, isLoading: suggestionsLoading } = useReorderSuggestions();
  const { data: alertsData, isLoading: alertsLoading } = useReorderAlerts({
    acknowledged: "false",
  });
  const { data: statistics, isLoading: statsLoading } = useReorderStatistics();
  const { data: itemsData } = useItems({ limit: 50 });

  const approveSuggestion = useApproveReorderSuggestion();
  const rejectSuggestion = useRejectReorderSuggestion();
  const acknowledgeAlerts = useAcknowledgeAlerts();

  const suggestions = suggestionsData || [];
  const alerts = useMemo(() => alertsData?.data || [], [alertsData?.data]);
  const items = itemsData?.data || [];
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [poLineItems, setPoLineItems] = useState<PurchaseOrderLineItemFormValues[]>([]);

  const handleApproveSuggestion = async (id: string) => {
    await approveSuggestion.mutateAsync(id);
  };

  const handleRejectSuggestion = async (id: string) => {
    await rejectSuggestion.mutateAsync(id);
  };

  const handleAcknowledgeAlert = async (id: string) => {
    await acknowledgeAlerts.mutateAsync({ alertIds: [id] });
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

  const handleCreatePurchaseOrder = () => {
    if (selectedAlertIds.length === 0) return;

    const selectedAlerts = alerts.filter((alert) => selectedAlertIds.includes(alert.id));
    const lineItems: PurchaseOrderLineItemFormValues[] = [];

    selectedAlerts.forEach((alert) => {
      const item = items.find((candidate) => candidate.id === alert.itemId);
      if (!item) return;

      const fallbackQty = Math.max(0.01, alert.reorderPoint - alert.currentStock);
      const quantity = alert.reorderQuantity > 0 ? alert.reorderQuantity : fallbackQty;

      lineItems.push({
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        quantity,
        rate: item.standardCost || item.listPrice || 0,
        uomId: item.uomId,
        discountPercent: 0,
        taxPercent: 0,
      });
    });

    if (lineItems.length === 0) {
      toast.error(t("noMatchingItemsForAlerts"));
      return;
    }

    setPoLineItems(lineItems);
    setPoDialogOpen(true);
  };

  const allAlertsSelected = alerts.length > 0 && selectedAlertIds.length === alerts.length;
  const someAlertsSelected = selectedAlertIds.length > 0 && !allAlertsSelected;

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
      pending: { variant: "outline" as const, label: t("pending") },
      approved: { variant: "default" as const, label: t("approved") },
      rejected: { variant: "destructive" as const, label: t("rejected") },
      ordered: { variant: "secondary" as const, label: t("ordered") },
    };
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statsLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="mb-2 h-8 w-16" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : statistics ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("itemsOk")}</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.itemsOk}</div>
                <p className="text-xs text-muted-foreground">{t("adequatelyStocked")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("lowStock")}</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.itemsLowStock}</div>
                <p className="text-xs text-muted-foreground">{t("belowReorderPoint")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("critical")}</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.itemsCritical}</div>
                <p className="text-xs text-muted-foreground">{t("belowMinimumLevel")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("pendingOrders")}</CardTitle>
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.pendingSuggestions}</div>
                <p className="text-xs text-muted-foreground">{t("awaitingApproval")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("estimatedCost")}</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(statistics.totalEstimatedReorderCost)}
                </div>
                <p className="text-xs text-muted-foreground">{t("totalReorderValue")}</p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Tabs for Suggestions and Alerts */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="suggestions">{t("reorderSuggestionsTab", { count: suggestions.length })}</TabsTrigger>
          <TabsTrigger value="alerts">{t("activeAlertsTab", { count: alerts.length })}</TabsTrigger>
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
                            <span className="text-muted-foreground">{t("estimatedCostShort")}:</span>
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
                  onClick={handleCreatePurchaseOrder}
                >
                  {t("createPurchaseOrder")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>{t("severity")}</TableHead>
                        <TableHead>{t("item")}</TableHead>
                        <TableHead>{t("warehouse")}</TableHead>
                        <TableHead>{t("stockLevel")}</TableHead>
                        <TableHead>{t("message")}</TableHead>
                        <TableHead className="text-right">{t("action")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[1, 2, 3].map((i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Skeleton className="h-4 w-4" />
                          </TableCell>
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
              ) : alerts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-600 opacity-50" />
                  <p>{t("noActiveAlerts")}</p>
                  <p className="mt-1 text-sm">{t("allStockLevelsAcceptable")}</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={
                              allAlertsSelected
                                ? true
                                : someAlertsSelected
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={(checked) => handleSelectAllAlerts(Boolean(checked))}
                            aria-label={t("selectAllAlerts")}
                          />
                        </TableHead>
                        <TableHead>{t("severity")}</TableHead>
                        <TableHead>{t("item")}</TableHead>
                        <TableHead>{t("warehouse")}</TableHead>
                        <TableHead>{t("stockLevel")}</TableHead>
                        <TableHead>{t("message")}</TableHead>
                        <TableHead className="text-right">{t("action")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedAlertIds.includes(alert.id)}
                              onCheckedChange={(checked) =>
                                toggleAlertSelection(alert.id, Boolean(checked))
                              }
                              aria-label={t("selectAlertFor", { itemName: alert.itemName })}
                            />
                          </TableCell>
                          <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                          <TableCell>
                            <div className="font-medium">{alert.itemName}</div>
                            <div className="text-xs text-muted-foreground">{alert.itemCode}</div>
                          </TableCell>
                          <TableCell>{alert.warehouseName}</TableCell>
                          <TableCell>
                            <div className="font-medium text-red-600">{alert.currentStock}</div>
                            <div className="text-xs text-muted-foreground">
                              {t("minLabel")}: {alert.minimumLevel} | {t("reorderShort")}: {alert.reorderPoint}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">{alert.message}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                              disabled={acknowledgeAlerts.isPending}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              {t("acknowledge")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {poDialogOpen && (
        <PurchaseOrderFormDialog
          open={poDialogOpen}
          onOpenChange={setPoDialogOpen}
          initialLineItems={poLineItems}
          initialActiveTab="items"
        />
      )}
    </div>
  );
}
