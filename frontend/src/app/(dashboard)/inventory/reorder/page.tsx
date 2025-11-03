"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Package,
  TrendingUp,
  RefreshCw,
  Eye,
  Check,
  X,
  ShoppingCart,
} from "lucide-react";
import { useReorderSuggestions, useReorderAlerts, useReorderStatistics, useApproveReorderSuggestion, useRejectReorderSuggestion, useAcknowledgeAlerts } from "@/hooks/useReorder";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default function ReorderManagementPage() {
  const [selectedTab, setSelectedTab] = useState("suggestions");
  const { formatCurrency } = useCurrency();

  const { data: suggestionsData, isLoading: suggestionsLoading } = useReorderSuggestions();
  const { data: alertsData, isLoading: alertsLoading } = useReorderAlerts({ acknowledged: "false" });
  const { data: statistics, isLoading: statsLoading } = useReorderStatistics();

  const approveSuggestion = useApproveReorderSuggestion();
  const rejectSuggestion = useRejectReorderSuggestion();
  const acknowledgeAlerts = useAcknowledgeAlerts();

  const suggestions = suggestionsData?.data || [];
  const alerts = alertsData?.data || [];

  const handleApproveSuggestion = async (id: string) => {
    await approveSuggestion.mutateAsync(id);
  };

  const handleRejectSuggestion = async (id: string) => {
    await rejectSuggestion.mutateAsync(id);
  };

  const handleAcknowledgeAlert = async (id: string) => {
    await acknowledgeAlerts.mutateAsync({ alertIds: [id] });
  };

  const getPriorityBadge = (priority: "high" | "medium" | "low") => {
    const variants = {
      high: { variant: "destructive" as const, label: "High Priority" },
      medium: { variant: "default" as const, label: "Medium Priority" },
      low: { variant: "secondary" as const, label: "Low Priority" },
    };
    const config = variants[priority];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: ReorderSuggestion["status"]) => {
    const variants = {
      pending: { variant: "outline" as const, label: "Pending" },
      approved: { variant: "default" as const, label: "Approved" },
      rejected: { variant: "destructive" as const, label: "Rejected" },
      ordered: { variant: "secondary" as const, label: "Ordered" },
    };
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSeverityBadge = (severity: ReorderAlert["severity"]) => {
    const variants = {
      critical: { variant: "destructive" as const, label: "Critical", icon: AlertTriangle },
      warning: { variant: "default" as const, label: "Warning", icon: AlertTriangle },
      info: { variant: "secondary" as const, label: "Info", icon: Package },
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reorder Management</h1>
        <p className="text-muted-foreground">
          Monitor stock levels, manage reorder suggestions, and configure automated restocking
        </p>
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
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : statistics ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Items OK</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.itemsOk}</div>
                <p className="text-xs text-muted-foreground">Adequately stocked</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.itemsLowStock}</div>
                <p className="text-xs text-muted-foreground">Below reorder point</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Critical</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.itemsCritical}</div>
                <p className="text-xs text-muted-foreground">Below minimum level</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.pendingSuggestions}</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Est. Cost</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(statistics.totalEstimatedReorderCost)}</div>
                <p className="text-xs text-muted-foreground">Total reorder value</p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Tabs for Suggestions and Alerts */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="suggestions">
            Reorder Suggestions ({suggestions.length})
          </TabsTrigger>
          <TabsTrigger value="alerts">
            Active Alerts ({alerts.length})
          </TabsTrigger>
        </TabsList>

        {/* Reorder Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reorder Suggestions</CardTitle>
              <CardDescription>
                Review and approve automatic reorder suggestions based on stock levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suggestionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <Skeleton className="h-5 w-48 mb-2" />
                        <Skeleton className="h-4 w-64 mb-1" />
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
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No reorder suggestions at this time</p>
                  <p className="text-sm mt-1">All items are adequately stocked</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{suggestion.itemName}</h3>
                          {getPriorityBadge(suggestion.priority)}
                          {getStatusBadge(suggestion.status)}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Item Code:</span>
                            <span className="ml-2 font-medium">{suggestion.itemCode}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Warehouse:</span>
                            <span className="ml-2 font-medium">{suggestion.warehouseName}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Current Stock:</span>
                            <span className="ml-2 font-medium text-red-600">{suggestion.currentStock}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Reorder Point:</span>
                            <span className="ml-2 font-medium">{suggestion.reorderPoint}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Suggested Qty:</span>
                            <span className="ml-2 font-medium">{suggestion.suggestedQuantity}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Est. Cost:</span>
                            <span className="ml-2 font-medium">{formatCurrency(suggestion.estimatedCost)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Supplier:</span>
                            <span className="ml-2 font-medium">{suggestion.supplierName}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Lead Time:</span>
                            <span className="ml-2 font-medium">{suggestion.expectedDeliveryDays} days</span>
                          </div>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Reason:</span>
                          <span className="ml-2">{suggestion.reason}</span>
                        </div>
                      </div>
                      {suggestion.status === "pending" && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveSuggestion(suggestion.id)}
                            disabled={approveSuggestion.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectSuggestion(suggestion.id)}
                            disabled={rejectSuggestion.isPending}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
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
              <CardTitle>Stock Level Alerts</CardTitle>
              <CardDescription>
                Critical and warning alerts for items requiring immediate attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Severity</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Stock Level</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[1, 2, 3].map((i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-600" />
                  <p>No active alerts</p>
                  <p className="text-sm mt-1">All stock levels are within acceptable ranges</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Severity</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Stock Level</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                          <TableCell>
                            <div className="font-medium">{alert.itemName}</div>
                            <div className="text-xs text-muted-foreground">{alert.itemCode}</div>
                          </TableCell>
                          <TableCell>{alert.warehouseName}</TableCell>
                          <TableCell>
                            <div className="font-medium text-red-600">{alert.currentStock}</div>
                            <div className="text-xs text-muted-foreground">
                              Min: {alert.minimumLevel} | Reorder: {alert.reorderPoint}
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
                              <Check className="h-4 w-4 mr-1" />
                              Acknowledge
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
    </div>
  );
}
