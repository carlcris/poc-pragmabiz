"use client";

import Link from "next/link";
import { CheckCircle, Clock, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePendingApprovals } from "@/hooks/usePurchasingDashboard";
import { formatDistanceToNow, parseISO, differenceInHours } from "date-fns";
import { cn } from "@/lib/utils";
import { WidgetEmptyState } from "./WidgetEmptyState";

export function PendingApprovalsWidget() {
  const { data, isLoading, error } = usePendingApprovals();

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>GRNs awaiting approval</CardDescription>
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
            <CheckCircle className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>GRNs awaiting approval</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">Failed to load pending approvals</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!data || data.count === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>GRNs awaiting approval</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={CheckCircle}
            title="All caught up!"
            description="No GRNs awaiting approval"
            variant="success"
          />
        </CardContent>
      </Card>
    );
  }

  // Calculate time pending for each GRN
  const now = new Date();
  const itemsWithTime = data.items.map((grn) => {
    const createdDate = grn.created_at ? parseISO(grn.created_at) : null;
    const hoursPending = createdDate ? differenceInHours(now, createdDate) : 0;
    const isOverdue = hoursPending > 24;

    return {
      ...grn,
      hoursPending,
      isOverdue,
      timeAgo: createdDate ? formatDistanceToNow(createdDate, { addSuffix: true }) : "Unknown",
    };
  });

  // Sort by most overdue first
  const sortedItems = itemsWithTime.sort((a, b) => b.hoursPending - a.hoursPending);
  const overdueCount = sortedItems.filter((item) => item.isOverdue).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>GRNs awaiting approval</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overdue Alert */}
        {overdueCount > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {overdueCount} {overdueCount === 1 ? "GRN has" : "GRNs have"} been pending for more than
              24 hours
            </AlertDescription>
          </Alert>
        )}

        {/* Total Count */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Awaiting Approval</span>
            </div>
            <span className="text-2xl font-bold text-right text-primary">{data.count}</span>
          </div>
        </div>

        {/* Pending GRNs List */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">GRNs</p>
          <div className="space-y-2">
            {sortedItems.slice(0, 5).map((grn) => {
              const llNumber = grn.load_list?.ll_number || "N/A";

              return (
                <Link
                  key={grn.id}
                  href={`/purchasing/grns/${grn.id}`}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50",
                    grn.isOverdue && "border-l-4 border-l-destructive bg-destructive/5"
                  )}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{grn.grn_number}</span>
                      {grn.isOverdue && <AlertCircle className="h-4 w-4 text-destructive" />}
                    </div>
                    <span className="text-xs text-muted-foreground">Load List: {llNumber}</span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{grn.timeAgo}</span>
                      {grn.hoursPending > 0 && (
                        <span className="text-muted-foreground/70">
                          ({grn.hoursPending} {grn.hoursPending === 1 ? "hr" : "hrs"})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge
                      variant={grn.isOverdue ? "destructive" : "secondary"}
                      className="justify-center"
                    >
                      {grn.isOverdue ? "Overdue" : "Pending"}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* View All Link */}
        {data.count > 5 && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/purchasing/grns?status=pending_approval">
              View All GRNs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
