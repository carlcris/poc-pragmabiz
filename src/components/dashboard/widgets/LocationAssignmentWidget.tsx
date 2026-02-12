"use client";

import Link from "next/link";
import { MapPin, Package, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocationAssignmentStatus } from "@/hooks/usePurchasingDashboard";
import { cn } from "@/lib/utils";
import { WidgetEmptyState } from "./WidgetEmptyState";

export function LocationAssignmentWidget() {
  const { data, isLoading, error } = useLocationAssignmentStatus();

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Location Assignment</CardTitle>
              <CardDescription>Warehouse location assignment status</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Location Assignment</CardTitle>
              <CardDescription>Warehouse location assignment status</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">Failed to load location data</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty/no data state
  if (!data || data.totalBoxes === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Location Assignment</CardTitle>
              <CardDescription>Warehouse location assignment status</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={MapPin}
            title="No boxes in system"
            description="No location data available"
          />
        </CardContent>
      </Card>
    );
  }

  const assignmentPercent = data.assignmentPercent;
  const isLowAssignment = assignmentPercent < 80;
  const isMediumAssignment = assignmentPercent >= 80 && assignmentPercent < 95;

  // Determine status color
  const statusConfig = {
    label: isLowAssignment ? "Poor" : isMediumAssignment ? "Good" : "Excellent",
    color: isLowAssignment
      ? "text-red-600"
      : isMediumAssignment
        ? "text-amber-600"
        : "text-green-600",
    bgColor: isLowAssignment
      ? "bg-red-100 text-red-700"
      : isMediumAssignment
        ? "bg-amber-100 text-amber-700"
        : "bg-green-100 text-green-700",
    progressColor: isLowAssignment
      ? "bg-red-500"
      : isMediumAssignment
        ? "bg-amber-500"
        : "bg-green-500",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>Location Assignment</CardTitle>
            <CardDescription>Warehouse location assignment status</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Low Assignment Alert */}
        {isLowAssignment && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Only {assignmentPercent.toFixed(1)}% of boxes have locations assigned. Please assign
              locations to improve tracking.
            </AlertDescription>
          </Alert>
        )}

        {/* Assignment Percentage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Assignment Rate</span>
            <span className={cn("text-2xl font-bold", statusConfig.color)}>
              {assignmentPercent.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", statusConfig.progressColor)}
              style={{ width: `${assignmentPercent}%` }}
            />
          </div>
          <div className="flex justify-center">
            <div className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusConfig.bgColor)}>
              {statusConfig.label}
            </div>
          </div>
        </div>

        {/* Box Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-muted/50 p-3 text-center">
            <div className="text-xs text-muted-foreground">Total</div>
            <p className="mt-1 text-lg font-bold">{data.totalBoxes}</p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-3 text-center">
            <div className="text-xs text-muted-foreground">Assigned</div>
            <p className="mt-1 text-lg font-bold text-green-600">{data.assignedBoxes}</p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-3 text-center">
            <div className="text-xs text-muted-foreground">Unassigned</div>
            <p className="mt-1 text-lg font-bold text-red-600">{data.unassignedBoxes}</p>
          </div>
        </div>

        {/* Assignment Breakdown */}
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 text-green-600" />
              <span>Locations Assigned</span>
            </div>
            <span className="font-semibold text-green-600">
              {data.assignedBoxes} boxes
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4 text-red-600" />
              <span>Need Assignment</span>
            </div>
            <span className="font-semibold text-red-600">
              {data.unassignedBoxes} boxes
            </span>
          </div>
        </div>

        {/* View Unassigned Button */}
        {data.unassignedBoxes > 0 && (
          <Button asChild variant="default" className="w-full">
            <Link href="/purchasing/grns?tab=unassigned-boxes">
              <Package className="mr-2 h-4 w-4" />
              View Unassigned Boxes ({data.unassignedBoxes})
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}

        {/* Recommendations */}
        {isLowAssignment && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">Recommendations:</p>
            <ul className="mt-1 space-y-1 text-xs text-amber-700">
              <li>• Assign locations to improve inventory tracking</li>
              <li>• Use batch assignment for efficiency</li>
              <li>• Review warehouse layout optimization</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
